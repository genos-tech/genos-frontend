import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteEditorCore } from "../features/notes/common/hooks/useNoteEditorCore";
import { saveNote } from "../features/notes/common/services/saveNote";
import {
    clearNoteCache,
    getCachedNote,
    upsertNoteCache,
    useNoteData,
} from "../hooks/notes/useNoteData";

// Regression coverage for the task/chat note "title reverts to the
// default" bug.
//
// A task/chat note can be open in two mounted panels at once — the
// task/chat-page inline editor AND the notes-home LRU-pool panel, which
// stays mounted because NoteHome is kept-alive. Each panel kept its own
// permanent copy of the title, so a rename made in one could go unseen by
// the other, whose next body autosave then PUT its stale copy back over
// the rename. The reporter saw the tab strip and sidebar hold the new
// title (they have their own update paths) while the title INPUT showed
// the old one — and then watched the old one overwrite everything.
//
// Three properties keep the panels convergent, one test group each:
//   1. `useNoteData`'s cache is reactive — a write refreshes every
//      mounted consumer of that note.
//   2. `useNoteEditorCore` DERIVES the displayed title from the note,
//      keeping a local copy only while the user is renaming in that
//      panel. There is no lasting copy left to go stale — the previous
//      attempt at this fix reconciled two copies instead, and its
//      reconciler could get permanently stuck (see the failed-save test).
//   3. Whatever the panel is displaying, a save resolves the title it
//      persists from the freshest source available at save time.
// The body is deliberately untouched by all of this: it re-syncs only on
// a note identity change, and the collaborative (Yjs) path owns it.

vi.mock("../features/notes/common/services/saveNote", () => ({
    saveNote: vi.fn().mockResolvedValue(undefined),
}));

// A note read out of IndexedDB, with a gate so a read can still be in
// flight when a save publishes a newer copy of the same note.
const idb: { row: unknown; gate: Promise<void> | null } = { row: null, gate: null };
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        async getTaskNote() {
            if (idb.gate) await idb.gate;
            return idb.row;
        }
        async getPersonalNote() {
            return null;
        }
        async getChatNote() {
            return null;
        }
    },
}));

const saveNoteMock = vi.mocked(saveNote);

type TestNote = {
    noteType: number;
    noteId: number;
    title: string;
    body: unknown[];
};

// Same note identity (noteType 2 / id 1), varying title.
const taskNote = (title: string): TestNote => ({ noteType: 2, noteId: 1, title, body: [] });

const renderCore = (initial: TestNote | null) =>
    renderHook(
        ({ currentNote }: { currentNote: TestNote | null }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            useNoteEditorCore<any>({
                currentNote,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                myself: {} as any,
                accessToken: "token",
                socket: null,
            }),
        { initialProps: { currentNote: initial } }
    );

describe("useNoteData reactive cache", () => {
    beforeEach(() => {
        clearNoteCache();
        idb.row = null;
        idb.gate = null;
    });

    const taskTab = {
        id: "task-1",
        kind: "task",
        noteType: 2,
        noteId: 1,
        projectId: 9,
        taskId: 8,
        teamId: "team-1",
        title: "seed",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myself = { teamId: "team-1", userId: "user-1" } as any;

    it("refreshes every mounted consumer when the cache is written", () => {
        // Pre-seed so both consumers resolve synchronously from cache (no
        // fetch, no NoteService), mirroring an already-open note.
        upsertNoteCache(taskNote("New Task Note (1)") as never);

        const panelA = renderHook(() => useNoteData(taskTab, { myself, accessToken: "token" }));
        const panelB = renderHook(() => useNoteData(taskTab, { myself, accessToken: "token" }));

        expect(panelA.result.current.note?.title).toBe("New Task Note (1)");
        expect(panelB.result.current.note?.title).toBe("New Task Note (1)");

        // A rename saved from a third surface writes the shared cache.
        act(() => {
            upsertNoteCache(taskNote("Real Title") as never);
        });

        // Both already-mounted panels see it — the stale snapshot is gone.
        expect(panelA.result.current.note?.title).toBe("Real Title");
        expect(panelB.result.current.note?.title).toBe("Real Title");
    });

    // The root cause of the reported revert. A panel that opens a note the
    // cache doesn't have starts an async read (IndexedDB goes through a
    // worker). If the note is renamed while that read is in flight, the
    // read resolves holding the PRE-rename row — and it used to write that
    // row straight into the shared cache, which then pushed the old title
    // into every mounted panel's title input. The tab label and sidebar
    // kept the new title (this path never touches them), so the note
    // looked renamed everywhere except the input the next autosave reads
    // from — and that autosave PUT the old title back over the rename.
    it("does not let an in-flight read displace a note renamed while it was loading", async () => {
        let release!: () => void;
        idb.row = taskNote("New Task Note (1)");
        idb.gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        // Cache miss: the panel mounts and starts the (gated) read.
        const panel = renderHook(() => useNoteData(taskTab, { myself, accessToken: "token" }));
        expect(panel.result.current.note).toBeNull();

        // A rename is saved on another surface while the read is in flight.
        act(() => {
            upsertNoteCache(taskNote("Renamed While Loading") as never);
        });
        expect(panel.result.current.note?.title).toBe("Renamed While Loading");

        // Now the stale read resolves. It must not resurrect the old title.
        await act(async () => {
            release();
            await idb.gate;
        });

        await waitFor(() => expect(panel.result.current.isLoading).toBe(false));
        expect(getCachedNote("task", 1)?.title).toBe("Renamed While Loading");
        expect(panel.result.current.note?.title).toBe("Renamed While Loading");
    });

    it("only notifies consumers of the written note, not others", () => {
        upsertNoteCache(taskNote("Task One") as never);
        upsertNoteCache({ noteType: 2, noteId: 2, title: "Task Two", body: [] } as never);

        const other = renderHook(() =>
            useNoteData(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { ...taskTab, id: "task-2", noteId: 2, title: "Task Two" } as any,
                { myself, accessToken: "token" }
            )
        );
        expect(other.result.current.note?.title).toBe("Task Two");

        // Write note 1 — the panel showing note 2 must not change.
        act(() => {
            upsertNoteCache(taskNote("Task One Renamed") as never);
        });
        expect(other.result.current.note?.title).toBe("Task Two");
    });
});

describe("useNoteEditorCore cross-surface title sync", () => {
    beforeEach(() => {
        // `updateNote` reads the shared cache to resolve the title it
        // persists, so leftover entries from the suite above would stand in
        // for this suite's `currentNote`.
        clearNoteCache();
        saveNoteMock.mockReset();
        saveNoteMock.mockResolvedValue(undefined);
    });

    it("adopts a title changed on another surface so a later save can't revert it", async () => {
        const { rerender, result } = renderCore(taskNote("New Task Note (1)"));
        expect(result.current.title).toBe("New Task Note (1)");

        // Another mounted panel renamed the note; the reactive cache
        // refreshes THIS panel's `currentNote` (same identity, new title).
        rerender({ currentNote: taskNote("Real Title") });
        expect(result.current.title).toBe("Real Title");

        // A body autosave must now PUT the fresh title, not the stale one.
        await act(async () => {
            await result.current.updateNote();
        });
        expect(saveNoteMock).toHaveBeenCalledTimes(1);
        expect(saveNoteMock.mock.calls[0][0]).toMatchObject({ title: "Real Title" });
    });

    it("does not clobber an in-progress local rename with an external title", () => {
        const { rerender, result } = renderCore(taskNote("New Task Note (1)"));

        // User is typing a new title in THIS panel.
        act(() => {
            result.current.handleTitleChange("My Local Rename");
        });
        expect(result.current.title).toBe("My Local Rename");

        // A concurrent external update arrives for the same note.
        rerender({ currentNote: taskNote("Someone Else's Title") });

        // The unsaved local edit wins.
        expect(result.current.title).toBe("My Local Rename");
    });

    it("adopts external titles again once the local rename is persisted", async () => {
        const { rerender, result } = renderCore(taskNote("New Task Note (1)"));

        act(() => {
            result.current.handleTitleChange("Local Rename");
        });
        await act(async () => {
            await result.current.updateNote();
        });
        expect(saveNoteMock.mock.calls[0][0]).toMatchObject({ title: "Local Rename" });

        // After the save the dirty guard is released, so a subsequent
        // external change reconciles again.
        rerender({ currentNote: taskNote("Later External Title") });
        expect(result.current.title).toBe("Later External Title");
    });

    it("never persists an empty title when the user clears the input", async () => {
        const { result } = renderCore(taskNote("Real Title"));

        // Clearing the input shows empty (it's what the user typed) but a
        // save must fall back to the note's real title rather than blank it.
        act(() => {
            result.current.handleTitleChange("");
        });
        expect(result.current.title).toBe("");

        await act(async () => {
            await result.current.updateNote();
        });
        expect(saveNoteMock.mock.calls[0][0]).toMatchObject({ title: "Real Title" });

        // ...and the input goes back to showing that real title.
        expect(result.current.title).toBe("Real Title");
    });

    // The regression that the first round of this fix missed. A local title
    // edit used to set a "dirty" flag that ONLY a successful save cleared,
    // while the reconciler recorded every external title it saw — including
    // the ones it declined to adopt while dirty. So a single failed save
    // (the IDB write inside `saveNote` rejecting was enough) left the panel
    // permanently unable to see renames from any other surface, and its
    // next body autosave PUT the stale title back over them.
    it("does not stay stuck on its own title after a FAILED save", async () => {
        const { rerender, result } = renderCore(taskNote("New Task Note (1)"));

        act(() => {
            result.current.handleTitleChange("Typed Then Failed");
        });
        saveNoteMock.mockRejectedValueOnce(new Error("PUT failed"));
        await act(async () => {
            await result.current.updateNote();
        });

        // The attempt carried what the user typed...
        expect(saveNoteMock.mock.calls[0][0]).toMatchObject({ title: "Typed Then Failed" });
        // ...but nothing was persisted, so the input shows the note's real
        // title instead of implying the rename stuck.
        expect(result.current.title).toBe("New Task Note (1)");

        // And a rename from another surface is still adopted afterwards,
        // rather than being masked by the failed attempt forever.
        rerender({ currentNote: taskNote("Correct Title") });
        expect(result.current.title).toBe("Correct Title");
    });

    it("a body autosave sends the freshest persisted title, not a stale snapshot", async () => {
        // This panel is holding an old snapshot: it mounted before the note
        // was renamed on another surface and never re-rendered with the new
        // one (a missed cache notification, an unmounting panel's flush, a
        // debounce timer that outlived the render...).
        const { result } = renderCore(taskNote("New Task Note (1)"));

        // The rename IS in the shared cache, because every save writes it.
        upsertNoteCache(taskNote("Renamed Elsewhere") as never);

        await act(async () => {
            await result.current.updateNote();
        });

        // The autosave must not carry this panel's stale title.
        expect(saveNoteMock.mock.calls[0][0]).toMatchObject({ title: "Renamed Elsewhere" });
    });

    it("fully re-syncs the title on a note identity change", () => {
        const { rerender, result } = renderCore(taskNote("Note One"));
        act(() => {
            result.current.handleTitleChange("dirty edit");
        });
        expect(result.current.title).toBe("dirty edit");

        // Switching to a DIFFERENT note resets both the dirty guard and
        // the title (existing tab-switch behavior, preserved).
        rerender({ currentNote: { noteType: 2, noteId: 2, title: "Note Two", body: [] } });
        expect(result.current.title).toBe("Note Two");
    });
});
