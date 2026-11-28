/**
 * MIP-2481: a roster that answers after another folder is shown must not be listed under it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalTeamFolderMembers } from "../features/notes/team-notes/modals/ModalTeamFolderMembers";
import type { UserProps } from "../types/admin";
import type { TeamNoteFolderTreeNode } from "../types/notes";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("../context/MentionGroupsContext", () => ({
    useMentionGroupsContext: () => ({ mentionGroups: [] }),
}));
vi.mock("../features/admin/components/team/ObjectSharesSection", () => ({
    ObjectSharesSection: () => null,
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));

const load = vi.hoisted(() => vi.fn<(m: unknown, folderId: number) => Promise<unknown>>());
vi.mock("../features/notes/team-notes/services/teamNoteFolderMembers", () => ({
    loadTeamFolderMembers: load,
    grantTeamFolderMembers: vi.fn(),
    revokeTeamFolderMember: vi.fn(),
}));

const roster = (userName: string) => [{ userId: userName, userName, roleId: 3 }];
const folder = (folderId: number) =>
    ({ folderId, name: "Folder", tags: [], myRoleId: 2 }) as unknown as TeamNoteFolderTreeNode;

const view = (shown: TeamNoteFolderTreeNode | null) => (
    <CssVarsProvider>
        <ModalTeamFolderMembers
            folder={shown}
            myself={{ userId: "u1", teamId: "t1" } as UserProps}
            open={shown !== null}
            socket={null}
            useCM={{ allChats: [] } as never}
            useTEM={{ currentTeam: { isGuest: false }, teamMembers: [] } as never}
            onChanged={() => {}}
            onClose={() => {}}
        />
    </CssVarsProvider>
);
const settle = () => act(async () => void (await Promise.resolve()));

/** Folder A's answer is held back until `answerA` is called. */
let answerA: () => void;
beforeEach(() => {
    load.mockReset();
    load.mockImplementation((_, folderId) =>
        folderId === 1
            ? new Promise((resolve) => (answerA = () => resolve(roster("Alice of A"))))
            : Promise.resolve(roster("Bob of B"))
    );
});

describe("team folder members, late answer", () => {
    it("shows B's members only when A answers after B", async () => {
        const { rerender } = render(view(folder(1)));
        rerender(view(null));
        rerender(view(folder(2)));
        await settle();
        await act(async () => answerA());
        expect(screen.getByText("Bob of B")).toBeTruthy();
        expect(screen.queryByText("Alice of A")).toBeNull();
    });

    it("does not show the last folder's members while the next one loads", async () => {
        const { rerender } = render(view(folder(2)));
        await settle();
        rerender(view(null));
        rerender(view(folder(1)));
        await settle();
        expect(screen.queryByText("Bob of B")).toBeNull();
    });
});
