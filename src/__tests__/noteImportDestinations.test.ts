/**
 * Import destinations offered on the task / chat note surfaces.
 *
 * The rule under test: a note can only live under a real task or a real
 * chat. The sidebar's grouping rows — a project, or the "DM" / "GM" / "PM"
 * buckets — are containers, never destinations, so they must not appear
 * as selectable options.
 */

import { describe, expect, it } from "vitest";

import {
    buildChatNoteDestinations,
    buildTaskNoteDestinations,
    chatDestinationKey,
    taskDestinationKey,
} from "../features/notes/common/services/noteImportDestinations";
import { en } from "../i18n/locales/en";
import { ChatNoteMetaProps, TaskNoteMetaProps } from "../types/notes";

const taskNote = (over: Partial<TaskNoteMetaProps>): TaskNoteMetaProps => ({
    noteType: 2,
    noteId: 1,
    parentNoteId: null,
    projectId: 7,
    taskId: 42,
    projectName: "Genos",
    taskTitle: "Fix login",
    displayId: "GEN-42",
    title: "note",
    tsUpdated: "",
    ...(over as TaskNoteMetaProps),
});

const chatNote = (over: Partial<ChatNoteMetaProps>): ChatNoteMetaProps => ({
    noteType: 3,
    noteId: 1,
    parentNoteId: null,
    chatType: 1,
    chatName: "Alex",
    chatId: 5,
    isThread: false,
    threadId: 0,
    title: "note",
    tsUpdated: "",
    ...(over as ChatNoteMetaProps),
});

describe("buildTaskNoteDestinations", () => {
    it("emits one row per task, never a project row", () => {
        const rows = buildTaskNoteDestinations(
            [
                taskNote({ noteId: 1 }),
                // Same task, second note — one row, not two.
                taskNote({ noteId: 2 }),
                taskNote({ noteId: 3, taskId: 43, taskTitle: "Ship it", displayId: "GEN-43" }),
            ],
            en
        );

        expect(rows.map((r) => r.key)).toEqual([
            taskDestinationKey(7, 42),
            taskDestinationKey(7, 43),
        ]);
        // Every row resolves to a concrete task anchor.
        expect(rows.every((r) => r.taskId > 0 && r.projectId > 0)).toBe(true);
    });

    it("labels a task with its container chain, including the milestone", () => {
        const [row] = buildTaskNoteDestinations(
            [taskNote({ milestoneId: 3, milestoneTitle: "Beta" })],
            en
        );

        expect(row.label).toBe("Genos › Beta › Fix login GEN-42");
    });

    it("falls back to generated names when the meta is sparse", () => {
        const [row] = buildTaskNoteDestinations(
            [
                taskNote({
                    projectName: undefined,
                    taskTitle: undefined,
                    displayId: null,
                }),
            ],
            en
        );

        // The id alone, not "Task #42 #42".
        expect(row.label).toBe("Project 7 › #42");
    });
});

describe("buildChatNoteDestinations", () => {
    it("emits one row per chat anchor, never a chat-type row", () => {
        const rows = buildChatNoteDestinations(
            [
                chatNote({ noteId: 1 }),
                chatNote({ noteId: 2 }),
                chatNote({ noteId: 3, chatType: 2, chatId: 9, chatName: "Design" }),
            ],
            en
        );

        expect(rows.map((r) => r.key)).toEqual([
            // Sorted by label: "DM › Alex" before "GM › Design".
            chatDestinationKey(1, 5, false, 0),
            chatDestinationKey(2, 9, false, 0),
        ]);
        expect(rows.map((r) => r.label)).toEqual(["DM › Alex", "GM › Design"]);
    });

    it("keeps a thread anchor distinct from its channel", () => {
        const rows = buildChatNoteDestinations(
            [chatNote({ noteId: 1 }), chatNote({ noteId: 2, isThread: true, threadId: 88 })],
            en
        );

        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.label)).toContain("DM › Alex › Thread 88");
    });
});
