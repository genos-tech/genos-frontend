/**
 * Faithful reproduction of the reported task-note "title reverts to the
 * default" bug, using the REAL `TaskNoteEditorPanel` (and therefore the
 * real `useNoteData` + `useNoteAutoSave`/`useNoteEditorCore` stack) on
 * both surfaces at once.
 *
 * The reporter's exact ordering:
 *   1. Create a task note from the task page (seeds every channel with
 *      the default title "New Task Note (1)").
 *   2. The note opens in the task-page inline panel.
 *   3. Rename it there and press Enter (blur → save).
 *   4. Navigate to the notes page.
 *   5. The same note is still open there (never closed).
 *   6. OBSERVED BUG: the notes-page title INPUT still shows the default
 *      title, even though the note tab + sidebar show the new one.
 *   7. Edit the body on the notes page.
 *   8. OBSERVED BUG: the save PUTs the stale title, so the tab + sidebar
 *      revert to "New Task Note (1)".
 *
 * Only the network + IDB edges are stubbed, so the panel composition
 * itself is under test. Two mount orderings are covered because they
 * exercise different halves of the sync: the notes-page panel already
 * mounted at rename time (notes home is kept alive once visited) vs.
 * mounting fresh afterwards.
 */

import "fake-indexeddb/auto";

import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addNote } from "../features/notes/common/services/addNote";
import { TaskNoteEditorPanel } from "../features/notes/task-notes/components/TaskNoteEditorPanel";
import { sendUpdatedTaskNote } from "../features/notes/task-notes/services/sendUpdatedTaskNote";
import { clearNoteCache, upsertNoteCache } from "../hooks/notes/useNoteData";
import type { NoteTab } from "../hooks/notes/useNoteTabs";
import { TaskNoteProps } from "../types/notes";

// --- edges of the system under test -------------------------------------

// The real save path runs; only its two sinks are stubbed.
vi.mock("../features/notes/task-notes/services/sendUpdatedTaskNote", () => ({
    sendUpdatedTaskNote: vi.fn().mockResolvedValue({}),
}));
vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn().mockResolvedValue(null),
}));
// Backend fallback must never be the thing that "fixes" the title.
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: vi.fn().mockResolvedValue({ error: "not-found" }),
}));

// IDB: `saveNote` writes through `addNote`, so mirror that into the fake
// store — this is what makes a page refresh show the correct title.
const idb: { taskNote: TaskNoteProps | null } = { taskNote: null };
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        async getTaskNote() {
            return idb.taskNote;
        }
        async getPersonalNote() {
            return null;
        }
        async getChatNote() {
            return null;
        }
    },
}));

// The BlockNote editor is replaced by a button that performs exactly what
// a real local body edit does: mark the body edited and hand up new blocks.
vi.mock("../components/editors/bnTaskNoteEditor", () => ({
    BnTaskNoteEditor: ({
        setBody,
        setNoteBodyEdited,
    }: {
        setBody: (b: unknown[]) => void;
        setNoteBodyEdited: (v: boolean) => void;
    }) => (
        <button
            type="button"
            onClick={() => {
                setBody([{ type: "paragraph", content: "edited body" }]);
                setNoteBodyEdited(true);
            }}
        >
            edit-body
        </button>
    ),
}));

const mockedSend = vi.mocked(sendUpdatedTaskNote);
const mockedAddNote = vi.mocked(addNote);

// --- fixtures -----------------------------------------------------------

const NOTE_ID = 5;
const DEFAULT_TITLE = "New Task Note (1)";
const RENAMED_TITLE = "Sprint Retro Notes";

const makeNote = (title: string): TaskNoteProps =>
    ({
        noteType: 2,
        noteId: NOTE_ID,
        projectId: 9,
        taskId: 8,
        title,
        body: [],
        ownerId: "u1",
        parentNoteId: null,
    }) as unknown as TaskNoteProps;

const makeTab = (title: string): NoteTab =>
    ({
        kind: "task",
        noteType: 2,
        noteId: NOTE_ID,
        projectId: 9,
        taskId: 8,
        id: `task-${NOTE_ID}`,
        title,
        teamId: "team-1",
    }) as unknown as NoteTab;

const myself = { teamId: "team-1", userId: "u1" } as never;

/**
 * Mirrors the real app's shared note state. The task page renders
 * `TaskNoteMain`'s inline panel (tab derived from `currentTaskNote`) and
 * the notes page renders the LRU editor pool (tab from `tabsApi.tabs`) —
 * both with tab id `task-5`, both sharing one `useNoteManagement`.
 */
const Harness = ({ mountNotesPanel }: { mountNotesPanel: boolean }) => {
    const [tab, setTab] = useState<NoteTab>(makeTab(DEFAULT_TITLE));
    const [taskNoteMeta, setTaskNoteMeta] = useState<TaskNoteProps[]>([makeNote(DEFAULT_TITLE)]);
    const [currentTaskNote, setCurrentTaskNote] = useState<TaskNoteProps | null>(
        makeNote(DEFAULT_TITLE)
    );

    const useNM = {
        tabsApi: {
            tabs: [tab],
            activeTabId: tab.id,
            liveTabIds: [tab.id],
            updateTabTitle: (_noteId: number, _kind: string, title: string) =>
                setTab((prev) => ({ ...prev, title })),
        },
        taskNoteMeta,
        setTaskNoteMeta,
        currentTaskNote,
        setCurrentTaskNote,
        bumpNoteVersionsHead: () => {},
        noteResyncNonce: 0,
        currentNoteMembers: [],
    } as never;

    const shared = {
        accessToken: "token",
        myself,
        setMyself: () => {},
        socket: null,
        useTEM: {} as never,
        useUISM: {} as never,
        useCM: {} as never,
        useNM,
    };

    return (
        <CssVarsProvider>
            {/* Task page: inline panel, tab derived from currentTaskNote. */}
            <div data-testid="task-page">
                <TaskNoteEditorPanel
                    {...shared}
                    tab={
                        {
                            ...makeTab(currentTaskNote?.title ?? ""),
                            title: currentTaskNote?.title ?? "",
                        } as never
                    }
                    isActive
                />
            </div>
            {/* Notes page: LRU pool panel, tab straight from tabsApi.tabs. */}
            {mountNotesPanel && (
                <div data-testid="notes-page">
                    <TaskNoteEditorPanel {...shared} tab={tab as never} isActive />
                </div>
            )}
        </CssVarsProvider>
    );
};

const titleInputIn = (testId: string): HTMLInputElement =>
    within(screen.getByTestId(testId)).getByRole("textbox") as HTMLInputElement;

// The tab label is the channel the reporter saw stay correct and then
// revert, so assert on it directly.
const savedTitles = () => mockedSend.mock.calls.map((c) => (c[1] as TaskNoteProps).title);

describe("task note title revert (reporter's repro)", () => {
    beforeEach(() => {
        clearNoteCache();
        mockedSend.mockClear();
        mockedSend.mockResolvedValue({} as never);
        mockedAddNote.mockClear();
        // `saveNote` write-through: keep the fake IDB honest.
        mockedAddNote.mockImplementation(async (_type: number, note: unknown) => {
            idb.taskNote = note as TaskNoteProps;
            return null;
        });
        // Step 1: creation seeds cache + IDB with the default title.
        idb.taskNote = makeNote(DEFAULT_TITLE);
        upsertNoteCache(makeNote(DEFAULT_TITLE) as never);
    });

    it("notes-page panel mounted BEFORE the rename adopts the new title", async () => {
        const user = userEvent.setup();
        render(<Harness mountNotesPanel />);

        await waitFor(() => expect(titleInputIn("task-page").value).toBe(DEFAULT_TITLE));
        expect(titleInputIn("notes-page").value).toBe(DEFAULT_TITLE);

        // Step 3: rename on the task page, Enter → blur → save.
        const taskTitle = titleInputIn("task-page");
        await user.clear(taskTitle);
        await user.type(taskTitle, RENAMED_TITLE);
        await act(async () => {
            taskTitle.blur();
        });

        await waitFor(() => expect(savedTitles()).toContain(RENAMED_TITLE));

        // Step 6: the notes-page title input must not still show the default.
        expect(titleInputIn("notes-page").value).toBe(RENAMED_TITLE);

        // Steps 7-8: a body edit on the notes page must not PUT the stale title.
        mockedSend.mockClear();
        await user.click(within(screen.getByTestId("notes-page")).getByText("edit-body"));
        // Real timers: wait out the 3s autosave debounce.
        await act(async () => {
            await new Promise((r) => setTimeout(r, 3200));
        });
        await waitFor(() => expect(savedTitles().length).toBeGreaterThan(0));
        expect(savedTitles()).not.toContain(DEFAULT_TITLE);
    }, 15000);

    it("notes-page panel mounted AFTER the rename shows the new title", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<Harness mountNotesPanel={false} />);

        await waitFor(() => expect(titleInputIn("task-page").value).toBe(DEFAULT_TITLE));

        const taskTitle = titleInputIn("task-page");
        await user.clear(taskTitle);
        await user.type(taskTitle, RENAMED_TITLE);
        await act(async () => {
            taskTitle.blur();
        });
        await waitFor(() => expect(savedTitles()).toContain(RENAMED_TITLE));

        // Step 4-5: navigate to the notes page; the note is still open.
        rerender(<Harness mountNotesPanel />);

        await waitFor(() => expect(titleInputIn("notes-page").value).toBe(RENAMED_TITLE));
    }, 15000);
});
