/**
 * MyNoteMain picks the My / Team header by the note's own space (MIP-830).
 *
 * It used to read the bucket off the page's ACTIVE TAB only. The note modal
 * shows a note that is not the page's active tab, so a team note opened there
 * (or over another My note) got the "My Notes" header and crumb.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyNoteMain } from "../features/notes/my-notes/components/MyNoteMain";
import { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/notes/team-notes/components/TeamNoteHeader", () => ({
    TeamNoteHeader: () => <div data-testid="team-header" />,
}));
vi.mock("../features/notes/my-notes/components/MyNoteHeader", () => ({
    MyNoteHeader: () => <div data-testid="my-header" />,
}));
vi.mock("../features/notes/common/components/NoteHeaderActions", () => ({
    NoteHeaderActions: ({ noteType }: { noteType: number }) => (
        <div data-notetype={noteType} data-testid="actions" />
    ),
}));
vi.mock("../features/notes/common/components/NoteTabStrip", () => ({
    NoteTabStrip: () => null,
}));
vi.mock("../features/notes/my-notes/modals/ModalDeleteMyNote", () => ({
    ModalDeleteMyNote: () => null,
}));
vi.mock("../features/notes/my-notes/components/MyNoteEditorPanel", () => ({
    MyNoteEditorPanel: () => null,
}));

const render_ = (over: Partial<NoteManagementState>) => {
    const useNM = {
        tabItems: [{ id: "t" }],
        selectedTabIndex: 0,
        currentMyNote: { noteId: 7, title: "Team note" },
        currentNoteType: 1,
        teamNoteMeta: [{ noteId: 7 }],
        sharedNoteMeta: [{ noteId: 9 }],
        myNoteMeta: [],
        setMyNoteMeta: vi.fn(),
        setIsTaskNoteVisible: vi.fn(),
        tabsApi: { activeTab: null },
        ...over,
    } as unknown as NoteManagementState;
    render(
        <CssVarsProvider>
            <MyNoteMain
                isInTaskPage={false}
                myself={{ userId: "u", teamId: "t" } as UserProps}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                useNM={useNM}
                useTEM={{} as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );
};

describe("MyNoteMain header", () => {
    it("shows the Team header for a team note even when the active tab is a different My note", () => {
        render_({
            currentNoteType: 1,
            tabsApi: { activeTab: { kind: "my", noteId: 1, bucket: "my" } } as never,
        });
        expect(screen.getByTestId("team-header")).toBeInTheDocument();
        expect(screen.queryByTestId("my-header")).not.toBeInTheDocument();
        expect(screen.getByTestId("actions").dataset.notetype).toBe("8");
    });

    it("shows the Team header in the modal when the lists don't know the note yet", () => {
        render_({
            teamNoteMeta: [],
            currentNoteType: 8,
            tabsApi: { activeTab: { kind: "my", noteId: 1, bucket: "my" } } as never,
        });
        expect(screen.getByTestId("team-header")).toBeInTheDocument();
    });

    it("keeps the My header for a My note", () => {
        render_({
            currentMyNote: { noteId: 1, title: "Mine" } as never,
            tabsApi: { activeTab: { kind: "my", noteId: 1, bucket: "my" } } as never,
        });
        expect(screen.getByTestId("my-header")).toBeInTheDocument();
        expect(screen.queryByTestId("team-header")).not.toBeInTheDocument();
    });
});
