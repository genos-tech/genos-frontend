/**
 * The preview→row mirror must not churn `allTasks` identity on a no-op.
 *
 * This effect exists to push an EDITED preview back onto its table row.
 * But it fires on every task OPEN too, because TaskPreview flips
 * `isTaskUpdated` as part of its ordinary mount/sync cycle — at which
 * point the patch rewrites the row to the values it already has.
 *
 * The old implementation used `prevTasks.map(...)`, which allocates a new
 * array unconditionally. A new `allTasks` identity is expensive far beyond
 * this hook: TaskFilterMenu re-runs `applyFilters` (a full walk) plus a
 * sort, the task table rebuilds `childrenByParent` / `displayRows`, and
 * the sprint board re-runs its column-organizing effect. All of that ran
 * on every single task open and scaled with the project's task count.
 *
 * So the contract is two-sided, and both sides matter:
 *   - a no-op patch must hand back the SAME array (no cascade);
 *   - a real edit must still produce a new array (or the table goes stale).
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));
// The mirror also refreshes task meta; keep it off the network.
vi.mock("../../features/notes/task-notes/services/loadTaskMeta", () => ({
    loadTaskMeta: vi.fn(async () => []),
}));

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

// A table row and the preview object that mirrors it EXACTLY. Every field
// the patch touches has to agree, otherwise the guard would be reported as
// working for the wrong reason.
const ROW: TaskTableProps = {
    id: "42",
    displayId: "PRJ-42",
    title: "Ship the thing",
    priority: "High",
    effortLevel: "M",
    createdDate: "2026-07-01",
    updatedAt: "2026-07-20 10:00:00",
    dueDate: "2026-07-25",
    daysLeft: 4,
    status: "Open",
    assigneeId: "u2",
    assigneeEmail: "a@example.com",
    assigneeName: "Ada",
    assigneeImgPath: "/img/u2.png",
    parentTaskId: null,
    rootTaskId: 42,
    threadId: null,
    tags: [{ tagName: "backend", tagColor: "#111", tagTextColor: "#fff" }],
    concatTags: "/backend/",
    teamId: "t1",
    projectId: 10,
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
} as unknown as TaskTableProps;

const previewFor = (over: Partial<Record<string, unknown>> = {}): TaskProps =>
    ({
        id: 42,
        title: "Ship the thing",
        priority: { priority: "High" },
        effortLevel: { level: "M" },
        status: { status: "Open" },
        createdDate: "2026-07-01",
        updatedAt: "2026-07-20 10:00:00",
        dueDate: "2026-07-25",
        daysLeft: 4,
        // A FRESH array instance every call, exactly as the preview
        // supplies it — the guard must compare tags by content, or it
        // would report "changed" on every open and never fire.
        tags: [{ tagName: "backend", tagColor: "#111", tagTextColor: "#fff" }],
        concatTags: "/backend/",
        assignee: {
            userId: "u2",
            userEmail: "a@example.com",
            userName: "Ada",
            avatarImgPath: "/img/u2.png",
        },
        parentTaskId: null,
        rootTaskId: 42,
        threadId: null,
        project: { projectId: 10 },
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskProps;

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

afterEach(() => {
    vi.clearAllMocks();
});

describe("useTaskManagement — preview→row mirror identity", () => {
    it("preserves allTasks identity when the patch changes nothing (task OPEN)", async () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        act(() => result.current.setAllTasks([ROW]));
        await flush();
        const before = result.current.allTasks;

        // Simulate what opening this task does: select it, hand the
        // preview the same values the row already has, flip the flag.
        act(() => result.current.setCurrentPreviewTaskId(42));
        act(() => result.current.setCurrentPreviewTask(previewFor()));
        act(() => result.current.setIsTaskUpdated(true));
        await flush();

        // Same ARRAY, not merely equal contents — identity is what the
        // downstream filter/sort/index cascade keys off.
        expect(result.current.allTasks).toBe(before);
    });

    it("still produces a new array (and patched row) on a real edit", async () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        act(() => result.current.setAllTasks([ROW]));
        await flush();
        const before = result.current.allTasks;

        act(() => result.current.setCurrentPreviewTaskId(42));
        act(() =>
            result.current.setCurrentPreviewTask(previewFor({ title: "Ship the thing (revised)" }))
        );
        act(() => result.current.setIsTaskUpdated(true));
        await flush();

        expect(result.current.allTasks).not.toBe(before);
        expect(result.current.allTasks[0].title).toBe("Ship the thing (revised)");
    });

    it("detects a tag-only edit despite tags arriving as a fresh array", async () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        act(() => result.current.setAllTasks([ROW]));
        await flush();
        const before = result.current.allTasks;

        act(() => result.current.setCurrentPreviewTaskId(42));
        act(() =>
            result.current.setCurrentPreviewTask(
                previewFor({
                    tags: [
                        { tagName: "backend", tagColor: "#111", tagTextColor: "#fff" },
                        { tagName: "urgent", tagColor: "#222", tagTextColor: "#fff" },
                    ],
                })
            )
        );
        act(() => result.current.setIsTaskUpdated(true));
        await flush();

        expect(result.current.allTasks).not.toBe(before);
        expect(result.current.allTasks[0].tags).toHaveLength(2);
    });
});
