import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NoteHeaderActions } from "../features/notes/common/components/NoteHeaderActions";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "t" }),
}));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        setTargetMutedByKey: vi.fn(),
    }),
}));
vi.mock("../features/notes/common/components/ModalNoteSharing", () => ({
    ModalNoteSharing: () => <div />,
}));
vi.mock("../features/notes/common/components/ModalNoteHistory", () => ({
    ModalNoteHistory: () => <div />,
}));
vi.mock("../features/notes/common/components/ModalImportMarkdown", () => ({
    ModalImportMarkdown: () => <div />,
}));

const useNM = {
    currentChatNote: null,
    currentMyNote: { body: [], noteId: 1, title: "A note" },
    currentNoteMembers: [],
    currentNoteVersions: [],
    myNoteFolders: [],
    myNoteMeta: [],
    currentTaskNote: null,
    loadNote: vi.fn(),
    setIsTaskNoteVisible: vi.fn(),
} as never;

const renderActions = () =>
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <NoteHeaderActions
                    currentTask={undefined}
                    isInTaskPage={false}
                    myself={{ userId: "u1", userName: "Me" } as never}
                    noteType={1}
                    pmChat={undefined}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useNM={useNM}
                    useTEM={{ teamMembers: [] } as never}
                    useUISM={{} as never}
                    onCloseNotes={vi.fn()}
                    onCreateChildNote={vi.fn()}
                    onCreateNewNote={vi.fn()}
                    onDeleteNote={vi.fn()}
                    onOpenTask={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );

/**
 * The note page could be dragged sideways on a phone because this action
 * row would not shrink: its buttons carry `minWidth: 36`, and a flex
 * container's automatic minimum size is its MIN-CONTENT width, so the row
 * overflowed the header and the note pane's `overflow: auto` turned that
 * into a page-wide horizontal scroll.
 *
 * jsdom has no layout engine, so this can't assert pixels. It asserts the
 * two declarations that make the overflow impossible — the same pattern
 * `NoteTabList` already uses for its tab strip. Note that `overflowX`
 * pulls double duty: besides scrolling, any non-`visible` overflow value
 * switches OFF the automatic minimum size that caused the bug.
 */
describe("NoteHeaderActions", () => {
    it("can shrink below its buttons and scrolls them instead of the page", () => {
        renderActions();
        // The row is the nearest flex ancestor shared by the action
        // buttons; grab it via one of them rather than a brittle selector.
        const row = screen.getAllByRole("button")[0].parentElement as HTMLElement;
        const style = getComputedStyle(row);
        expect(style.minWidth).toBe("0px");
        expect(style.overflowX).toBe("auto");
        expect(style.overflowY).toBe("hidden");
    });
});
