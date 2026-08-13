import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteEditorCore } from "../features/notes/common/hooks/useNoteEditorCore";
// eslint-disable-next-line import/first
import { saveNote } from "../features/notes/common/services/saveNote";
import { clearNoteCache, upsertNoteCache, useNoteData } from "../hooks/notes/useNoteData";

// Regression coverage for the task/chat note "title reverts to the
// default" bug.
//
// A task/chat note can be open in two mounted panels at once — the
// task/chat-page inline editor AND the notes-home LRU-pool panel, which
// stays mounted because NoteHome is kept-alive. A rename saved from one
// panel used to be invisible to the other: `useNoteData`'s cache write
// didn't notify already-mounted consumers, and `useNoteEditorCore` only
// re-synced its local `title` on a note IDENTITY change. So the second
// panel kept the stale default title and, on its next autosave, PUT it
// back over the rename.
//
// The fix has two halves, one test group each:
//   1. `useNoteData` cache is reactive — a write refreshes every mounted
//      consumer of that note.
//   2. `useNoteEditorCore` adopts an externally-changed title (guarded so
//      an in-progress local rename is never clobbered, and never touching
//      the body).

vi.mock("../features/notes/common/services/saveNote", () => ({
    saveNote: vi.fn().mockResolvedValue(undefined),
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
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    it("does not adopt an empty external title over a real local one (same note)", () => {
        const { rerender, result } = renderCore(taskNote("Real Title"));
        // A same-identity refresh that carries an empty title (e.g. a
        // malformed snapshot) must not blank a real title the panel holds.
        rerender({ currentNote: taskNote("") });
        expect(result.current.title).toBe("Real Title");
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
