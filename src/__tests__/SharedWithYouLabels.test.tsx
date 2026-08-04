/**
 * "Whose is this?" — the label on work another team shared with yours.
 *
 * A shared project, chat or note folder now sits in the guest team's OWN
 * lists, among rows that behave differently: the host can end the share,
 * and the item's rules are theirs to set. So each row has to name the
 * owning team, and — the part that is easy to get wrong — the HOST's copy
 * of the same object must not be labelled, because both sides of a share
 * are "external" and only one side is looking at somebody else's thing.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatListItemTitle } from "../features/chat/components/sidebar/ChatListItemTitle";
import { TeamNoteFolderTree } from "../features/notes/team-notes/components/TeamNoteFolderTree";
import { ProjectIdentityRow } from "../features/tasks/components/ProjectIdentityRow";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";
import type { TeamNoteFolderTreeNode } from "../types/notes";
import type { ProjectProps } from "../types/tasks";

vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({ loaded: false, tags: [], assignmentsByChannelId: {} }),
}));

const wrap = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);

const project = (extra: Partial<ProjectProps>) =>
    ({
        projectId: 1,
        projectName: "Rebrand",
        projectTags: [],
        projectLabels: [],
        isPrivate: false,
        ...extra,
    }) as ProjectProps;

describe("a project shared with your team", () => {
    it("names the owning team on the row", () => {
        wrap(
            <ProjectIdentityRow
                project={project({ isExternal: true, hostTeamName: "Northwind" })}
            />
        );
        expect(screen.getByTitle(/Northwind/)).toBeInTheDocument();
    });

    it("says something even when the team's name did not arrive", () => {
        wrap(<ProjectIdentityRow project={project({ isExternal: true })} />);
        expect(screen.getByTitle(/another team/i)).toBeInTheDocument();
    });

    it("leaves an ordinary project unlabelled", () => {
        wrap(<ProjectIdentityRow project={project({})} />);
        expect(screen.queryByTitle(/shared/i)).not.toBeInTheDocument();
    });
});

const chat = (extra: Partial<AllChatProps>) =>
    ({
        chatType: 2,
        chatId: "c1",
        chatName: "Launch room",
        dmPartnerUser: { userId: "" } as UserProps,
        ...extra,
    }) as AllChatProps;

const chatDeps = {
    isYou: false,
    myself: { userId: "u1", customStatus: "" } as UserProps,
    useTEM: { teamMemberProfiles: {} } as unknown as TeamManagementState,
};

describe("an external chat in the sidebar", () => {
    it("is badged with the team whose room it is", () => {
        wrap(
            <ChatListItemTitle
                {...chatDeps}
                chat={chat({ isExternal: true, hostTeamName: "Northwind" })}
            />
        );
        expect(screen.getByText("Northwind")).toBeInTheDocument();
    });

    it("falls back to the plain badge on the host's own side", () => {
        // The host's chat is external too — it just isn't somebody
        // else's, so the server sends no team name for it.
        wrap(<ChatListItemTitle {...chatDeps} chat={chat({ isExternal: true })} />);
        expect(screen.getByText("External")).toBeInTheDocument();
    });

    it("badges nothing on an internal chat", () => {
        wrap(<ChatListItemTitle {...chatDeps} chat={chat({})} />);
        expect(screen.queryByText("External")).not.toBeInTheDocument();
    });
});

const folder = (extra: Partial<TeamNoteFolderTreeNode>) =>
    ({
        folderId: 10,
        parentFolderId: null,
        name: "Client Handbook",
        visibility: "private",
        effectiveVisibility: "private",
        myRoleId: 2,
        ownerId: "u9",
        ownerName: "Ada",
        memberCount: 2,
        tags: [],
        childFolders: [],
        notes: [],
        ...extra,
    }) as TeamNoteFolderTreeNode;

const folderDeps = {
    useNM: {
        isFolderExpanded: () => false,
        toggleFolderExpanded: vi.fn(),
    } as unknown as NoteManagementState,
    actions: {
        onCreateNoteHere: vi.fn(),
        onImportNoteHere: vi.fn(),
        onCreateSubfolder: vi.fn(),
        onRenameFolder: vi.fn(),
        onMoveFolder: vi.fn(),
        onManageMembers: vi.fn(),
        onEditTags: vi.fn(),
        onDeleteFolder: vi.fn(),
    },
    renderNote: () => null,
};

describe("a note folder shared with your team", () => {
    it("is chipped with the owning team at the root of the share", () => {
        wrap(
            <TeamNoteFolderTree
                {...folderDeps}
                folder={folder({ isExternal: true, hostTeamName: "Northwind" })}
            />
        );
        expect(screen.getByText("Northwind")).toBeInTheDocument();
    });

    it("does not repeat the chip on subfolders inside the share", () => {
        // The label answers "why is another team's folder in my list",
        // which only the root has to answer.
        wrap(
            <TeamNoteFolderTree
                {...folderDeps}
                folder={folder({
                    folderId: 11,
                    parentFolderId: 10,
                    name: "Our Workstream",
                    isExternal: true,
                    hostTeamName: "Northwind",
                })}
            />
        );
        expect(screen.queryByText("Northwind")).not.toBeInTheDocument();
    });

    it("leaves your own folder unchipped", () => {
        wrap(<TeamNoteFolderTree {...folderDeps} folder={folder({})} />);
        expect(screen.queryByText("Shared")).not.toBeInTheDocument();
    });
});
