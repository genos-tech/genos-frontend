import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { markProjectArchived, resetArchiveStateForTests } from "../features/archive/archiveState";
import {
    refuseCreateTaskInArchivedChat,
    useCreateTaskBlockedByArchive,
} from "../features/archive/createTaskGuard";
import * as notifier from "../services/requestErrorNotifier";
import type { ProjectProps } from "../types/tasks";

const project = (projectId: number) =>
    ({ projectId, projectName: `P${projectId}` }) as ProjectProps;
const chat = (projectId: number | null) => ({
    chatId: "c1",
    project: projectId === null ? null : { projectId },
});

describe("chat 'create task' entry for an archived project (MIP-1934)", () => {
    beforeEach(() => {
        resetArchiveStateForTests();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("refuses with the archived message and tells the caller", () => {
        const emit = vi.spyOn(notifier, "emitRequestError").mockImplementation(() => {});
        markProjectArchived(project(7), true);
        expect(refuseCreateTaskInArchivedChat(chat(7))).toBe(true);
        expect(emit).toHaveBeenCalledWith("archived");
    });

    it("lets a live project's chat through, silently", () => {
        const emit = vi.spyOn(notifier, "emitRequestError").mockImplementation(() => {});
        markProjectArchived(project(7), true);
        expect(refuseCreateTaskInArchivedChat(chat(8))).toBe(false);
        expect(refuseCreateTaskInArchivedChat(chat(null))).toBe(false);
        expect(emit).not.toHaveBeenCalled();
    });

    it("drops a create intent while the project is archived, so the form cannot appear on unarchive", () => {
        const setIsCreatingTask = vi.fn();
        const { result } = renderHook(() =>
            useCreateTaskBlockedByArchive(7, true, setIsCreatingTask)
        );
        expect(result.current).toBe(false);
        expect(setIsCreatingTask).not.toHaveBeenCalled();

        act(() => markProjectArchived(project(7), true));
        expect(result.current).toBe(true);
        expect(setIsCreatingTask).toHaveBeenCalledTimes(1);
        const updater = setIsCreatingTask.mock.calls[0][0];
        expect(updater({ flag: true, parentTaskId: 3 })).toEqual({ flag: false, parentTaskId: 3 });
    });
});

describe("the chat and phone surfaces use the gate and stay readable (MIP-1934)", () => {
    const read = (p: string) => readFileSync(p, "utf8");

    it("both chat homes do not mount the create form for an archived project", () => {
        for (const p of [
            "src/features/chat/chatHome.tsx",
            "src/features/chat/MobileChatHome.tsx",
        ]) {
            const src = read(p);
            expect(src).toContain("useCreateTaskBlockedByArchive");
            expect(src).toMatch(/isActiveRoute\s*&&\s*!createBlocked/);
        }
    });

    it("the chat header entries refuse for an archived project", () => {
        for (const p of [
            "src/features/chat/components/headers/MainChatPaneHeader.tsx",
            "src/features/chat/components/headers/SubChatPaneHeader.tsx",
        ]) {
            expect(read(p)).toContain("refuseCreateTaskInArchivedChat");
        }
    });

    it("the phone task list and preview are not inert (only the note stays read-only)", () => {
        const src = read("src/features/tasks/MobileTaskHome.tsx");
        expect(src.match(/inert=/g)?.length).toBe(1);
        expect(src).toMatch(/<Box inert=\{archived\}>\s*<TaskNoteMain/);
    });
});
