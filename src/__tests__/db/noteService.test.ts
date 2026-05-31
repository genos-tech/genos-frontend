/**
 * IndexedDB tests for the note data layer (fake-indexeddb/auto).
 * Exercising `NoteService` drives `NoteRepository` (×3 stores via the
 * factory), so one suite covers src/db/services/note.service.ts and
 * src/db/repositories/note.ts.
 *
 * Note stores key on `noteId`; owner indexes key on `ownerId`; the
 * related-id indexes key on `taskId` (task notes) / `chatId` (chat notes).
 * Index queries silently return [] on a keyPath/field mismatch, so the
 * by-user / by-related queries assert POSITIVE retrieval (right rows by
 * identity), not just that the wrong owner is absent.
 *
 * Scope: the full working surface of NoteService. (Two dead, broken
 * methods — `searchNotesByContent` / `getNotesByDateRange`, which read
 * non-existent `content` / `createdAt` fields — were removed in the
 * accompanying change rather than tested.)
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { NoteService } from "../../db/services/note.service";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

function makePersonal(o: Partial<MyNoteProps> = {}): MyNoteProps {
    return {
        noteType: 1,
        teamId: "t1",
        ownerId: "alice",
        roleId: 1,
        noteId: 1,
        parentNoteId: null,
        title: "Personal",
        body: [],
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...o,
    };
}

function makeTaskNote(o: Partial<TaskNoteProps> = {}): TaskNoteProps {
    return {
        noteType: 2,
        teamId: "t1",
        ownerId: "alice",
        roleId: 1,
        noteId: 1,
        parentNoteId: null,
        projectId: 1,
        taskId: 100,
        title: "TaskNote",
        body: [],
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...o,
    };
}

function makeChatNote(o: Partial<ChatNoteProps> = {}): ChatNoteProps {
    return {
        noteType: 3,
        teamId: "t1",
        ownerId: "alice",
        roleId: 1,
        noteId: 1,
        parentNoteId: null,
        chatType: 1,
        chatId: 500,
        isThread: false,
        threadId: 0,
        title: "ChatNote",
        body: [],
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...o,
    };
}

beforeEach(async () => {
    await deleteDB(DB_NAME);
});

describe("NoteService — per-type CRUD", () => {
    let svc: NoteService;
    beforeEach(() => {
        svc = new NoteService();
    });

    it("personal note save/get/exists/delete round-trip", async () => {
        expect(await svc.savePersonalNote(makePersonal({ noteId: 1, title: "P1" }))).toBe(true);
        expect((await svc.getPersonalNote(1))?.title).toBe("P1");
        expect(await svc.personalNoteExists(1)).toBe(true);
        expect(await svc.deletePersonalNote(1)).toBe(true);
        expect(await svc.getPersonalNote(1)).toBeNull();
        expect(await svc.personalNoteExists(1)).toBe(false);
    });

    it("task note save/get round-trip (type-discriminated getter)", async () => {
        await svc.saveTaskNote(makeTaskNote({ noteId: 1, taskId: 100, title: "T1" }));
        const n = await svc.getTaskNote(1);
        expect(n?.title).toBe("T1");
        expect(n?.taskId).toBe(100);
    });

    it("chat note save/get round-trip (type-discriminated getter)", async () => {
        await svc.saveChatNote(makeChatNote({ noteId: 1, chatId: 500, title: "C1" }));
        const n = await svc.getChatNote(1);
        expect(n?.title).toBe("C1");
        expect(n?.chatId).toBe(500);
    });

    it("getTaskNote returns null when the stored row lacks task fields", async () => {
        // A row in the task-notes store missing projectId/taskId fails the
        // shape check and is treated as "not a task note".
        await svc.saveTaskNote({
            noteType: 2,
            noteId: 9,
            title: "bad",
        } as unknown as TaskNoteProps);
        expect(await svc.getTaskNote(9)).toBeNull();
    });

    it("getChatNote returns null when the stored row lacks chat fields", async () => {
        await svc.saveChatNote({
            noteType: 3,
            noteId: 9,
            title: "bad",
        } as unknown as ChatNoteProps);
        expect(await svc.getChatNote(9)).toBeNull();
    });

    it("task/chat note exists + delete delegate per store", async () => {
        await svc.saveTaskNote(makeTaskNote({ noteId: 1 }));
        await svc.saveChatNote(makeChatNote({ noteId: 2 }));
        expect(await svc.taskNoteExists(1)).toBe(true);
        expect(await svc.chatNoteExists(2)).toBe(true);
        expect(await svc.deleteTaskNote(1)).toBe(true);
        expect(await svc.deleteChatNote(2)).toBe(true);
        expect(await svc.taskNoteExists(1)).toBe(false);
        expect(await svc.chatNoteExists(2)).toBe(false);
    });

    it("getAll* return everything in each store", async () => {
        await svc.batchInsertPersonalNotes([
            makePersonal({ noteId: 1 }),
            makePersonal({ noteId: 2 }),
        ]);
        await svc.batchInsertTaskNotes([makeTaskNote({ noteId: 3 })]);
        await svc.batchInsertChatNotes([makeChatNote({ noteId: 4 })]);
        expect((await svc.getAllPersonalNotes()).length).toBe(2);
        expect((await svc.getAllTaskNotes()).length).toBe(1);
        expect((await svc.getAllChatNotes()).length).toBe(1);
    });
});

describe("NoteService — indexed by-user / by-related queries", () => {
    let svc: NoteService;
    beforeEach(async () => {
        svc = new NoteService();
        await svc.batchInsertPersonalNotes([
            makePersonal({ noteId: 1, ownerId: "alice" }),
            makePersonal({ noteId: 2, ownerId: "alice" }),
            makePersonal({ noteId: 3, ownerId: "bob" }),
        ]);
        await svc.batchInsertTaskNotes([
            makeTaskNote({ noteId: 10, ownerId: "alice", taskId: 100 }),
            makeTaskNote({ noteId: 11, ownerId: "bob", taskId: 100 }),
            makeTaskNote({ noteId: 12, ownerId: "alice", taskId: 200 }),
        ]);
        await svc.batchInsertChatNotes([
            makeChatNote({ noteId: 20, ownerId: "alice", chatId: 500 }),
            makeChatNote({ noteId: 21, ownerId: "alice", chatId: 600 }),
        ]);
    });

    it("getPersonalNotesByUser filters on the owner index", async () => {
        expect((await svc.getPersonalNotesByUser("alice")).map((n) => n.noteId).sort()).toEqual([
            1, 2,
        ]);
        expect((await svc.getPersonalNotesByUser("bob")).map((n) => n.noteId)).toEqual([3]);
    });

    it("getTaskNotesByUser filters on the owner index", async () => {
        expect((await svc.getTaskNotesByUser("alice")).map((n) => n.noteId).sort()).toEqual([
            10, 12,
        ]);
    });

    it("getTaskNotesByTaskId filters on the task-id related index", async () => {
        // Both alice's and bob's notes on task 100, none from task 200.
        expect((await svc.getTaskNotesByTaskId(100)).map((n) => n.noteId).sort()).toEqual([
            10, 11,
        ]);
        expect((await svc.getTaskNotesByTaskId(200)).map((n) => n.noteId)).toEqual([12]);
    });

    it("getChatNotesByUser / getChatNotesByChatId filter correctly", async () => {
        expect((await svc.getChatNotesByUser("alice")).map((n) => n.noteId).sort()).toEqual([
            20, 21,
        ]);
        expect((await svc.getChatNotesByChatId(600)).map((n) => n.noteId)).toEqual([21]);
    });

    it("getAllNotesForUser merges the three types, newest tsCreated first", async () => {
        // distinct timestamps so the sort order is deterministic.
        await deleteDB(DB_NAME);
        const svc2 = new NoteService();
        await svc2.savePersonalNote(
            makePersonal({ noteId: 1, ownerId: "carol", tsCreated: "2026-03-01T00:00:00Z" })
        );
        await svc2.saveTaskNote(
            makeTaskNote({ noteId: 2, ownerId: "carol", tsCreated: "2026-05-01T00:00:00Z" })
        );
        await svc2.saveChatNote(
            makeChatNote({ noteId: 3, ownerId: "carol", tsCreated: "2026-01-01T00:00:00Z" })
        );
        const all = await svc2.getAllNotesForUser("carol");
        expect(all.map((n) => n.noteId)).toEqual([2, 1, 3]); // May, Mar, Jan
    });
});
