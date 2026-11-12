/**
 * MIP-1422: opening a thread activity for a DM thread with no task opened the chat page's task
 * pane, which then showed "Loading task..." forever. And Ken's rule since: the task view on the
 * chat page opens only when the user opens a task, never by itself.
 *
 * The chain, link by link:
 *   1. the v3 activity adapter writes a missing task id as 0 (`msg.taskId ?? 0`);
 *   2. the thread built from that activity carried the 0 (`chatListItemForActivity`);
 *   3. `useThreadTaskHandling` copied any id that is not null into the preview selection;
 *   4. the pane counted any id but -1 as "a task to show", and chat never gives up a load,
 *      so it waited for task 0 for good.
 * Each link is guarded now, and each guard has its own test here. The "never opens by itself"
 * rule (an open is asked for, not a selection made) is tested end to end in
 * `taskPreviewKeepAliveSurfaces.test.tsx` and on the hook in `SurfaceTaskPreviewVisible.test.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { getTaskPreviewPaneState } from "../features/tasks/utils/taskPreviewPaneState";
import {
    hasTaskPreviewContent,
    isRealTaskId,
} from "../features/tasks/utils/taskPreviewPaneVisibility";
import { useThreadTaskHandling } from "../hooks/common/useThreadTaskHandling";
import { useDropStaleSurfacePreview } from "../hooks/tasks/useDropStaleSurfacePreview";
import { useTaskManagement } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const myself = {
    userId: "me",
    userName: "me",
    userEmail: "",
    teamId: "t",
    teamName: "T",
} as unknown as UserProps;

// A plain DM thread reply: no task anywhere (task_id null on the wire).
const dmThreadReply = {
    id: "act-1",
    activityType: 1, // THREAD_REPLY
    recipientUserId: "me",
    teamId: "t",
    channelId: "2ea5e352-1530-4172-a645-2f104c7c90d3",
    channelKind: 1,
    messageId: "msg-1",
    actor: { userId: "u2", userName: "aki", userEmail: "" },
    message: {
        id: "msg-1",
        channelId: "2ea5e352-1530-4172-a645-2f104c7c90d3",
        channelKind: 1,
        sender: { userId: "u2", userName: "aki", userEmail: "" },
        seq: 398,
        bodyText: "yes",
        parentId: "8315c189-d94c-4cf6-a553-825505e7a509",
        isThreadReply: true,
        taskId: null,
    },
    meta: {},
    isRead: false,
    tsCreated: "2026-11-12T00:00:00Z",
} as unknown as Parameters<typeof v3ActivityToLegacy>[0];

const selection = (taskId: number) => ({
    currentPreviewTask: undefined,
    currentPreviewTaskId: taskId,
    currentPreviewKind: "task" as const,
    currentPreviewMilestoneId: -1,
});

describe("MIP-1422: a thread with no task never becomes a task to show", () => {
    it("(the cause) the activity adapter still writes a missing task id as 0", () => {
        // Not a guard: the adapter is left alone because other readers rely on a number.
        // This pins the input every guard below has to survive.
        expect(v3ActivityToLegacy(dmThreadReply, myself).taskId).toBe(0);
    });

    it("the thread built from an activity carries no task, not 0", () => {
        // The handler is deep inside a large component; read the line the way the other
        // wiring tests here do. The URL path (`useChatRouting`) has always done the same.
        // Only the plain thread handler: the task-comment handler builds its thread inside
        // `if (activity.taskId)`, so its id is always a real task.
        const text = read("features/chat/components/sidebar/activity/chatListItemForActivity.tsx");
        const start = text.indexOf("const handleThreadMessageActivity");
        const end = text.indexOf("const handleTaskBodyActivity");
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const handler = text.slice(start, end);
        expect(handler).toMatch(/taskId: activity\.taskId \|\| null,\s*messages: threadMessages/);
        expect(handler).not.toMatch(/taskId: activity\.taskId,/);
    });

    it("useThreadTaskHandling does not select task 0", () => {
        const setCurrentPreviewTaskId = vi.fn();
        renderHook(() =>
            useThreadTaskHandling({
                useCM: { currentThreadChat: { taskId: 0 }, isThreadVisible: true },
                useTM: { setCurrentPreviewTaskId },
            })
        );
        expect(setCurrentPreviewTaskId).not.toHaveBeenCalled();
    });

    it("useThreadTaskHandling still selects a thread's real task (it selects, never opens)", () => {
        const setCurrentPreviewTaskId = vi.fn();
        const setIsTaskPreviewVisible = vi.fn();
        renderHook(() =>
            useThreadTaskHandling({
                useCM: { currentThreadChat: { taskId: 42 }, isThreadVisible: true },
                useTM: { setCurrentPreviewTaskId, setIsTaskPreviewVisible },
            })
        );
        expect(setCurrentPreviewTaskId).toHaveBeenCalledWith(42);
        expect(setIsTaskPreviewVisible).not.toHaveBeenCalled();
    });

    it("the pane has nothing to show for task 0", () => {
        expect(isRealTaskId(0)).toBe(false);
        expect(isRealTaskId(-1)).toBe(false);
        expect(isRealTaskId(7)).toBe(true);
        expect(hasTaskPreviewContent(selection(0))).toBe(false);
        expect(hasTaskPreviewContent(selection(7))).toBe(true);
    });

    it("chat's pane is empty, not loading for good, when task 0 is asked for", () => {
        const input = {
            workingCopyId: undefined,
            guard: true,
            releaseOnLoadFailure: false,
            loadFailedTaskId: 0,
        };
        expect(getTaskPreviewPaneState({ ...input, requestedId: 0 })).toBe("empty");
        expect(getTaskPreviewPaneState({ ...input, requestedId: 7 })).toBe("loading");
    });
});

describe("MIP-1422: an open is ASKED for, a selection is not", () => {
    it("useTaskManagement counts every request to show the preview, even when it is already shown", () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));
        const start = result.current.previewOpenCount;
        act(() => result.current.setIsTaskPreviewVisible(true));
        act(() => result.current.setIsTaskPreviewVisible(true));
        expect(result.current.previewOpenCount).toBe(start + 2);
        expect(result.current.isTaskPreviewVisible).toBe(true);
    });

    it("selecting a task or closing the preview is not a request to show it", () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));
        const start = result.current.previewOpenCount;
        act(() => result.current.setCurrentPreviewTaskId(9));
        act(() => result.current.setIsTaskPreviewVisible(false));
        expect(result.current.previewOpenCount).toBe(start);
    });

    it("the setter keeps one identity across renders, like the state setter it wraps", () => {
        const { result, rerender } = renderHook(() => useTaskManagement(myself, "token"));
        const first = result.current.setIsTaskPreviewVisible;
        // Open twice (the count moves) and re-render: still the same function, so an
        // effect that lists it does not re-run on every open.
        act(() => result.current.setIsTaskPreviewVisible(true));
        act(() => result.current.setIsTaskPreviewVisible(true));
        rerender();
        expect(result.current.setIsTaskPreviewVisible).toBe(first);
    });
});

describe("MIP-1422: a surface flag left up while the pane is hidden is put down", () => {
    const run = (props: {
        isActiveRoute?: boolean;
        intentPending?: boolean;
        surfaceVisible: boolean;
        paneVisible: boolean;
    }) => {
        const setSurfaceVisible = vi.fn();
        renderHook(() =>
            useDropStaleSurfacePreview({
                isActiveRoute: props.isActiveRoute ?? true,
                intentPending: props.intentPending ?? false,
                surfaceVisible: props.surfaceVisible,
                paneVisible: props.paneVisible,
                setSurfaceVisible,
            })
        );
        return setSurfaceVisible;
    };

    it("puts it down when it is up and the pane is not showing", () => {
        expect(run({ surfaceVisible: true, paneVisible: false })).toHaveBeenCalledWith(false);
    });

    it("leaves an open pane alone (the latch keeps it up across a thread switch)", () => {
        expect(run({ surfaceVisible: true, paneVisible: true })).not.toHaveBeenCalled();
    });

    it("leaves it alone while the cross-page 'open this task here' intent is consumed", () => {
        expect(
            run({ surfaceVisible: true, paneVisible: false, intentPending: true })
        ).not.toHaveBeenCalled();
    });

    it("leaves it alone while the page is in the background", () => {
        expect(
            run({ surfaceVisible: true, paneVisible: false, isActiveRoute: false })
        ).not.toHaveBeenCalled();
    });

    it("does nothing when the flag is already down", () => {
        expect(run({ surfaceVisible: false, paneVisible: false })).not.toHaveBeenCalled();
    });
});
