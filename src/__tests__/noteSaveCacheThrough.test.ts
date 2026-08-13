/**
 * `saveNote` is the single place a note edit is persisted, so it is also
 * where the client-side tiers are refreshed: the in-memory note cache
 * first, then IndexedDB.
 *
 * Doing the in-memory write here — rather than leaving it to each
 * editor's `onNoteUpdate` callback — is what makes the "note title
 * reverts to the default" bug unreachable. `addNote` is a worker
 * round-trip that can reject, and it used to be awaited bare: the
 * rejection propagated out of `saveNote`, the caller's catch swallowed
 * it, and `onNoteUpdate` never ran. The backend then held the rename
 * while every in-memory reader still held the old title, and the next
 * autosave from any panel PUT the old title back over it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { addNote } from "../features/notes/common/services/addNote";
import { saveNote } from "../features/notes/common/services/saveNote";
import { sendUpdatedTaskNote } from "../features/notes/task-notes/services/sendUpdatedTaskNote";
import { clearNoteCache, getCachedNote } from "../hooks/notes/useNoteData";
import { TaskNoteProps } from "../types/notes";

vi.mock("../features/notes/task-notes/services/sendUpdatedTaskNote", () => ({
    sendUpdatedTaskNote: vi.fn().mockResolvedValue({}),
}));
vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn().mockResolvedValue(null),
}));

const mockedSend = vi.mocked(sendUpdatedTaskNote);
const mockedAddNote = vi.mocked(addNote);

const myself = { teamId: "team-1", userId: "u1" } as never;

const taskNote = (title: string): TaskNoteProps =>
    ({
        noteType: 2,
        noteId: 7,
        projectId: 9,
        taskId: 8,
        title,
        body: [],
    }) as unknown as TaskNoteProps;

describe("saveNote cache write-through", () => {
    beforeEach(() => {
        clearNoteCache();
        mockedSend.mockClear();
        mockedSend.mockResolvedValue({} as never);
        mockedAddNote.mockClear();
        mockedAddNote.mockResolvedValue(null as never);
    });

    it("publishes the saved note to the in-memory cache", async () => {
        await saveNote(taskNote("Renamed"), myself, "token", null);

        // Every mounted panel showing this note reads through this cache, so
        // this is what stops a second panel from holding the old title.
        expect(getCachedNote("task", 7)?.title).toBe("Renamed");
    });

    it("still publishes the rename when the IndexedDB write fails", async () => {
        mockedAddNote.mockRejectedValueOnce(new Error("worker unavailable"));

        // The save must not report failure: the backend PUT succeeded and
        // IDB is only a cache.
        await expect(
            saveNote(taskNote("Renamed"), myself, "token", null)
        ).resolves.toBeUndefined();
        expect(getCachedNote("task", 7)?.title).toBe("Renamed");
    });

    it("does not publish anything when the backend PUT fails", async () => {
        mockedSend.mockRejectedValueOnce(new Error("500"));

        await expect(saveNote(taskNote("Renamed"), myself, "token", null)).rejects.toThrow("500");
        expect(getCachedNote("task", 7)).toBeNull();
        expect(mockedAddNote).not.toHaveBeenCalled();
    });
});
