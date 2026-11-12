/**
 * The note and folder "…" menus list their shared actions in the same order
 * (MIP-903).
 *
 * My Notes and Team Notes folders both offer New note, Import, Export, New
 * subfolder, Rename, Move and Delete, and used to put them in different places
 * (Export after Import in one, after Move in the other). The note header and
 * the task-note header share Share, Copy link, New note, Move, Import, Export,
 * Mute and Delete. Every one of those comes out in the one shared order now.
 */

import { DragDropContext } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatNoteHeader } from "../features/notes/chat-notes/components/ChatNoteHeader";
import { NoteHeaderActions } from "../features/notes/common/components/NoteHeaderActions";
import { MyNoteFolderTree } from "../features/notes/my-notes/components/MyNoteFolderTree";
import { TeamNoteFolderTree } from "../features/notes/team-notes/components/TeamNoteFolderTree";
import { en } from "../i18n/locales/en";

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
vi.mock("../features/notes/common/components/ModalMoveToFolder", () => ({
    ModalMoveToFolder: () => <div />,
}));
vi.mock("../features/notes/chat-notes/modals/ModalDeleteChatNote", () => ({
    ModalDeleteChatNote: () => <div />,
}));
vi.mock("../features/notes/common/components/NoteBreadcrumbs", () => ({
    NoteBreadcrumbs: () => <div />,
}));
vi.mock("../features/notes/chat-notes/components/autocompletes/ACChatChildNotes", () => ({
    ACChatChildNotes: () => <div />,
}));
vi.mock("../features/noteAsk", () => ({
    NoteAskModal: () => <div />,
    useNoteAsk: () => ({ open: vi.fn() }),
}));
// Avatars need their own provider; nothing here is about them.
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));
vi.mock("../components/ui/avatars/ProjectAvatar", () => ({
    ProjectAvatar: () => <span />,
}));

afterEach(cleanup);

const menuLabels = () => {
    fireEvent.click(screen.getByLabelText("More options"));
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

/** What `a` and `b` have in common, each in its own order. */
const shared = (a: (string | null)[], b: (string | null)[]) => [
    a.filter((l) => b.includes(l)),
    b.filter((l) => a.includes(l)),
];

const { header, history, folders, exportZip, teamNotes, sidebar } = en.notes;
const mute = en.services.notifications.muteButton.mute;

describe("note header menu", () => {
    const version = { versionId: 1 };
    const useNM = {
        currentChatNote: null,
        currentMyNote: { body: [], noteId: 1, title: "A note", folderId: null },
        currentTaskNote: {
            body: [],
            noteId: 2,
            projectId: 7,
            taskId: 42,
            title: "Task note",
        },
        currentNoteMembers: [{ userId: "u1", roleId: 1 }],
        currentNoteVersions: [version],
        myNoteFolders: [],
        myNoteMeta: [],
        loadNote: vi.fn(),
        setIsTaskNoteVisible: vi.fn(),
    } as never;

    const renderHeader = (props: Record<string, unknown>) =>
        render(
            <MemoryRouter>
                <CssVarsProvider>
                    <NoteHeaderActions
                        currentTask={undefined}
                        isInTaskPage={false}
                        myself={{ userId: "u1", userName: "Me" } as never}
                        pmChat={undefined}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useNM={useNM}
                        useTEM={{ teamMembers: [] } as never}
                        useUISM={{} as never}
                        onCloseNotes={vi.fn()}
                        onCopyNoteLink={vi.fn()}
                        onCreateChildNote={vi.fn()}
                        onCreateNewNote={vi.fn()}
                        onDeleteNote={vi.fn()}
                        onOpenTask={vi.fn()}
                        {...(props as { noteType: number })}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );

    it("lists a personal note's actions in the shared order", () => {
        renderHeader({ noteType: 1 });
        expect(menuLabels()).toEqual([
            header.shareEllipsis,
            header.copyNoteLink,
            header.newNote,
            header.childNote,
            folders.moveToFolder,
            history.viewVersions,
            header.importMarkdown,
            header.exportMarkdown,
            mute,
            header.deleteNote,
        ]);
    });

    it("leads a task note's menu with the ways to open it", () => {
        renderHeader({
            noteType: 2,
            isInTaskPage: true,
            currentTask: { id: 42, project: { projectId: 7 } },
        });
        const labels = menuLabels();
        expect(labels.slice(0, 4)).toEqual([
            header.openTask,
            header.openInNotes,
            header.shareEllipsis,
            header.copyNoteLink,
        ]);
        expect(labels.at(-1)).toBe(header.deleteNote);
    });
});

describe("chat note header menu", () => {
    const useNM = {
        currentChatNote: {
            body: [],
            chatId: "ch-1",
            chatType: 2,
            isThread: false,
            noteId: 3,
            threadId: "th-1",
            title: "Chat note",
        },
        currentChatNoteChain: [],
        currentNoteVersions: [{ versionId: 1 }],
        loadNote: vi.fn(),
    } as never;

    it("lists a chat note's actions in the shared order, agreeing with the note header", () => {
        render(
            <MemoryRouter>
                <CssVarsProvider>
                    <ChatNoteHeader
                        chat={undefined as never}
                        handleCloseTab={vi.fn()}
                        isInChatPage={true}
                        isInTaskPage={false}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        openDeleteNote={false}
                        openSearchBox={false}
                        setMyself={vi.fn()}
                        setOpenDeleteNote={vi.fn()}
                        setOpenSearchBox={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useNM={useNM}
                        usePM={{} as never}
                        useTEM={{ teamMemberProfiles: [] } as never}
                        useTM={{} as never}
                        useUISM={{} as never}
                        onCreateChildNote={vi.fn()}
                        onDeleteNote={vi.fn()}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
        expect(menuLabels()).toEqual([
            header.openInNotes,
            header.copyNoteLink,
            header.childNote,
            history.viewVersions,
            header.importMarkdown,
            header.exportMarkdown,
            mute,
            header.deleteNote,
        ]);
    });
});

describe("folder menus", () => {
    const useNM = {
        isFolderExpanded: () => false,
        toggleFolderExpanded: vi.fn(),
        isFolderFavorited: () => false,
        toggleFolderFavorite: vi.fn(),
        highlightedFolderId: null,
    } as never;

    const folderBase = {
        folderId: 5,
        name: "Docs",
        childFolders: [],
        notes: [],
        parentFolderId: null,
    };

    const noop = vi.fn();
    const myActions = {
        onCreateNoteHere: noop,
        onImportNoteHere: noop,
        onExportFolder: noop,
        onCreateSubfolder: noop,
        onRenameFolder: noop,
        onMoveFolder: noop,
        onDeleteFolder: noop,
    };
    const teamActions = { ...myActions, onManageMembers: noop, onEditTags: noop };

    const renderMine = () =>
        render(
            <CssVarsProvider>
                <DragDropContext onDragEnd={noop}>
                    <MyNoteFolderTree
                        actions={myActions}
                        folder={folderBase as never}
                        renderNote={() => null}
                        useNM={useNM}
                    />
                </DragDropContext>
            </CssVarsProvider>
        );

    const renderTeam = () =>
        render(
            <CssVarsProvider>
                <TeamNoteFolderTree
                    actions={teamActions}
                    renderNote={() => null}
                    useNM={useNM}
                    folder={
                        {
                            ...folderBase,
                            // Owner of an ordinary (non-shared) team folder: everything is on offer.
                            myRoleId: 1,
                            isExternal: false,
                            tags: [],
                            visibility: "public",
                            effectiveVisibility: "public",
                        } as never
                    }
                />
            </CssVarsProvider>
        );

    it("lists My Notes folder actions in the shared order", () => {
        renderMine();
        expect(menuLabels()).toEqual([
            // "personal" group (a mark that is yours alone) comes before "create" (MIP-1430)
            sidebar.addToFavorites,
            folders.newNoteHere,
            folders.newSubfolder,
            folders.rename,
            folders.moveFolder,
            header.importMarkdown,
            exportZip.menuItem,
            folders.deleteFolder,
        ]);
    });

    it("lists Team Notes folder actions in the shared order", () => {
        renderTeam();
        expect(menuLabels()).toEqual([
            sidebar.addToFavorites,
            folders.newNoteHere,
            folders.newSubfolder,
            folders.rename,
            folders.moveFolder,
            teamNotes.editTags,
            teamNotes.manageAccess,
            header.importMarkdown,
            exportZip.menuItem,
            folders.deleteFolder,
        ]);
    });

    it("agree on the order of what My Notes and Team Notes folders share", () => {
        renderMine();
        const mine = menuLabels();
        cleanup();
        renderTeam();
        const team = menuLabels();

        const [a, b] = shared(mine, team);
        expect(a).toEqual(b);
        expect(a).toHaveLength(mine.length);
    });
});
