/**
 * MIP-1435: the note header's delete dialogs (My / Shared / Team, Task, Chat) delete through
 * `useNM.delete*NoteById`, the one path that takes the note out of every list. They used to
 * clean up on their own, and the My one filtered only the My list.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalDeleteChatNote } from "../features/notes/chat-notes/modals/ModalDeleteChatNote";
import { ModalDeleteMyNote } from "../features/notes/my-notes/modals/ModalDeleteMyNote";
import { ModalDeleteTaskNote } from "../features/notes/task-notes/modals/ModalDeleteTaskNote";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const meta = (noteId: number, parentNoteId: number | null = null) => ({
    noteId,
    parentNoteId,
    title: `Note ${noteId}`,
});

const makeUseNM = (over: Record<string, unknown> = {}) =>
    ({
        myNoteMeta: [],
        teamNoteMeta: [],
        sharedNoteMeta: [],
        taskNoteMeta: [],
        chatNoteMeta: [],
        currentTaskNote: { noteId: 7, title: "Note 7" },
        currentChatNote: { noteId: 7, title: "Note 7" },
        deleteMyNoteById: vi.fn(async () => true),
        deleteTaskNoteById: vi.fn(async () => true),
        deleteChatNoteById: vi.fn(async () => true),
        ...over,
    }) as unknown as NoteManagementState;

const shell = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);
const confirm = () =>
    fireEvent.click(screen.getByRole("button", { name: en.notes.deleteModal.confirm }));

const CASES = [
    {
        name: "My / Shared / Team note",
        by: "deleteMyNoteById",
        children: "teamNoteMeta",
        modal: (useNM: NoteManagementState, setOpen = vi.fn()) => (
            <ModalDeleteMyNote
                currentMyNote={{ noteId: 7, title: "Note 7" } as never}
                openDeleteNote
                setOpenDeleteNote={setOpen}
                useNM={useNM}
            />
        ),
    },
    {
        name: "Task note",
        by: "deleteTaskNoteById",
        children: "taskNoteMeta",
        modal: (useNM: NoteManagementState, setOpen = vi.fn()) => (
            <ModalDeleteTaskNote openDeleteNote setOpenDeleteNote={setOpen} useNM={useNM} />
        ),
    },
    {
        name: "Chat note",
        by: "deleteChatNoteById",
        children: "chatNoteMeta",
        modal: (useNM: NoteManagementState, setOpen = vi.fn()) => (
            <ModalDeleteChatNote openDeleteNote setOpenDeleteNote={setOpen} useNM={useNM} />
        ),
    },
] as const;

describe.each(CASES)("$name", ({ by, children, modal }) => {
    it("deletes through the shared path, then closes", async () => {
        const useNM = makeUseNM();
        const setOpen = vi.fn();
        shell(modal(useNM, setOpen));
        confirm();
        await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
        expect(useNM[by]).toHaveBeenCalledWith(7);
    });

    it("says so and stays open when the note was not deleted", async () => {
        const useNM = makeUseNM({ [by]: vi.fn(async () => false) });
        const setOpen = vi.fn();
        shell(modal(useNM, setOpen));
        confirm();
        expect(await screen.findByText(en.notes.deleteModal.failed)).toBeTruthy();
        expect(setOpen).not.toHaveBeenCalledWith(false);
    });

    it("refuses a note that has a sub-note without asking the server", async () => {
        const useNM = makeUseNM({ [children]: [meta(8, 7)] });
        shell(modal(useNM));
        confirm();
        expect(await screen.findByText(en.notes.deleteModal.childExistsError)).toBeTruthy();
        expect(useNM[by]).not.toHaveBeenCalled();
    });
});
