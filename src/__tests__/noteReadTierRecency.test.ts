/**
 * A note read back from the backend is stale by the time it resolves — a
 * rename may have been saved while the request was in flight. `cacheFetchedNote`
 * is the single entry point for "publish a note I just fetched", and it
 * enforces oldest-loses across BOTH client tiers.
 *
 * The in-memory half of that rule alone was not enough. Every read path also
 * mirrored its row into IndexedDB with a bare `addNote`, which has no recency
 * check, so a read that lost the race was rejected from memory and written to
 * IndexedDB anyway. Nothing looked wrong until the next page load, when the
 * in-memory cache starts empty and that rolled-back row is what IndexedDB
 * hands back — the same "title reverts to the default" report, one reload
 * later.
 *
 * The return value carries the winner because callers use it directly: to
 * label a tab (`useNoteTabs.resolveRefToTab`, `loadNote`) and to feed the
 * legacy renderer state (`useNoteManagement`'s active-tab sync). Discarding it
 * put the losing read's title on screen even when the cache had rejected it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { addNote } from "../features/notes/common/services/addNote";
import {
    cacheFetchedNote,
    clearNoteCache,
    getCachedNote,
    upsertNoteCache,
} from "../hooks/notes/useNoteData";
import { TaskNoteProps } from "../types/notes";

vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn().mockResolvedValue(null),
}));

const mockedAddNote = vi.mocked(addNote);

const taskNote = (title: string, tsUpdated?: string): TaskNoteProps =>
    ({
        noteType: 2,
        noteId: 7,
        projectId: 9,
        taskId: 8,
        title,
        body: [],
        ...(tsUpdated ? { tsUpdated } : {}),
    }) as unknown as TaskNoteProps;

describe("cacheFetchedNote recency", () => {
    beforeEach(() => {
        clearNoteCache();
        mockedAddNote.mockClear();
        mockedAddNote.mockResolvedValue(null as never);
    });

    it("publishes a fetched note to both tiers when nothing newer exists", () => {
        const fetched = taskNote("From Backend");

        const winner = cacheFetchedNote(fetched);

        expect(winner).toBe(fetched);
        expect(getCachedNote("task", 7)?.title).toBe("From Backend");
        expect(mockedAddNote).toHaveBeenCalledTimes(1);
        expect(mockedAddNote.mock.calls[0][1]).toMatchObject({ title: "From Backend" });
    });

    it("keeps the newer note and writes NEITHER tier when the read lost the race", () => {
        // A rename was saved while the fetch below was in flight.
        upsertNoteCache(taskNote("Renamed While Fetching"));

        const winner = cacheFetchedNote(taskNote("New Task Note (1)"));

        // The caller gets the rename, so the tab label / renderer it feeds
        // cannot show the row this read carried.
        expect(winner.title).toBe("Renamed While Fetching");
        expect(getCachedNote("task", 7)?.title).toBe("Renamed While Fetching");
        // ...and IndexedDB is not rolled back, so the next page load agrees.
        expect(mockedAddNote).not.toHaveBeenCalled();
    });

    // Nothing evicts the in-memory cache (`removeFromNoteCache` and
    // `clearNoteCache` have no production callers) and an entry can be seeded
    // from a tier that outlives the session — tab rehydrate reads IndexedDB
    // rows on boot. So "a read never wins" would permanently pin a superseded
    // title: a rename made in another session has no other way in (there is no
    // socket event for it), the panel would display the old title, and its next
    // autosave would PUT it back — destroying someone else's rename. A
    // strictly newer server row must be able to land.
    it("lets a strictly newer server row correct a stale cached entry", () => {
        upsertNoteCache(taskNote("Stale From IndexedDB", "2026-08-13T09:00:00Z"));

        const fresh = taskNote("Renamed In Another Session", "2026-08-13T10:00:00Z");
        const winner = cacheFetchedNote(fresh);

        expect(winner).toBe(fresh);
        expect(getCachedNote("task", 7)?.title).toBe("Renamed In Another Session");
        // The newer row is the truth, so IndexedDB gets it too.
        expect(mockedAddNote).toHaveBeenCalledTimes(1);
    });

    it("rejects an older server row even when the cached copy is a read", () => {
        cacheFetchedNote(taskNote("Current", "2026-08-13T10:00:00Z"));
        mockedAddNote.mockClear();

        const winner = cacheFetchedNote(taskNote("Superseded", "2026-08-13T09:00:00Z"));

        expect(winner.title).toBe("Current");
        expect(mockedAddNote).not.toHaveBeenCalled();
    });

    // The tie is what protects a local rename: `saveNote` publishes the note
    // object it PUT, which still carries the PRE-save `tsUpdated`, so a read
    // that started before that save carries the same stamp. Equal stamps must
    // keep the cached copy or the reported bug comes straight back.
    it("keeps the cached copy when the stamps are equal", () => {
        upsertNoteCache(taskNote("Renamed", "2026-08-13T09:00:00Z"));

        const winner = cacheFetchedNote(taskNote("New Task Note (1)", "2026-08-13T09:00:00Z"));

        expect(winner.title).toBe("Renamed");
        expect(mockedAddNote).not.toHaveBeenCalled();
    });

    it("does not resurrect a note whose newer copy is a different object with the same title", () => {
        // Identity, not title equality, decides the winner: two distinct
        // objects with equal titles must not fool the guard into a second
        // IndexedDB write.
        upsertNoteCache(taskNote("Same Title"));

        cacheFetchedNote(taskNote("Same Title"));

        expect(mockedAddNote).not.toHaveBeenCalled();
    });
});
