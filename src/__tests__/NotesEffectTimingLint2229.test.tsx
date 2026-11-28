/**
 * MIP-2229: the `react-hooks/exhaustive-deps` fixes in `features/notes` must not change WHEN an
 * effect runs. Each of these would fail if the value now read through a ref were a dependency, or
 * if the ref held an old value.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACChatChildNotes } from "../features/notes/chat-notes/components/autocompletes/ACChatChildNotes";
import { NoteTypeSection } from "../features/notes/common/components/NoteTypeSection";
import { ACTaskNotes } from "../features/notes/task-notes/components/autocompletes/ACTaskNotes";
import { ModalTeamFolderMembers } from "../features/notes/team-notes/modals/ModalTeamFolderMembers";
import { ModalTeamFolderTags } from "../features/notes/team-notes/modals/ModalTeamFolderTags";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";
import type { TeamNoteFolderTreeNode } from "../types/notes";

const auth = vi.hoisted(() => ({ accessToken: "token-1" }));
vi.mock("../context/authState", () => ({ useAuth: () => auth }));
vi.mock("../context/MentionGroupsContext", () => ({
    useMentionGroupsContext: () => ({ mentionGroups: [] }),
}));
vi.mock("../features/admin/components/team/ObjectSharesSection", () => ({
    ObjectSharesSection: () => null,
}));

// Loads that never answer: the box stays "loading", the modals stay on what they were given.
const loads = vi.hoisted(() => ({
    task: vi.fn(() => new Promise<never>(() => {})),
    chat: vi.fn(() => new Promise<never>(() => {})),
    members: vi.fn(async () => []),
    tags: vi.fn(async () => []),
}));
vi.mock("../features/notes/task-notes/services/loadTaskNotes", () => ({
    loadTaskNotes: loads.task,
}));
vi.mock("../features/notes/chat-notes/services/loadChatSubNotes", () => ({
    loadChatSubNotes: loads.chat,
}));
vi.mock("../features/notes/team-notes/services/teamNoteFolderMembers", () => ({
    loadTeamFolderMembers: loads.members,
    grantTeamFolderMembers: vi.fn(),
    revokeTeamFolderMember: vi.fn(),
}));
vi.mock("../features/notes/team-notes/services/teamNoteFolderTags", () => ({
    loadNoteFolderTags: loads.tags,
    createNoteFolderTag: vi.fn(),
    deleteNoteFolderTag: vi.fn(),
    setFolderTags: vi.fn(),
    updateNoteFolderTag: vi.fn(),
}));

const member = (userId: string) => ({ userId, teamId: "t1" }) as UserProps;
const settle = () => act(async () => void (await Promise.resolve()));

beforeEach(() => {
    auth.accessToken = "token-1";
    Object.values(loads).forEach((load) => load.mockClear());
});

describe("the note search boxes", () => {
    const boxes = [
        {
            name: "task notes",
            Box: ACTaskNotes,
            load: loads.task,
            nm: (n: number) => ({ currentTaskNote: { projectId: n, taskId: n * 10 } }),
            args: (user: string, n: number, token: string) => [member(user), n, n * 10, token],
        },
        {
            name: "child notes",
            Box: ACChatChildNotes,
            load: loads.chat,
            nm: (n: number) => ({ currentChatNote: { noteId: n } }),
            args: (user: string, n: number, token: string) => [member(user), n, token],
        },
    ];

    it.each(boxes)("$name: loads once per opening and per target", async (box) => {
        const view = (open: boolean, user: string, n: number) => (
            <CssVarsProvider>
                <box.Box
                    myself={member(user)}
                    openSearchBox={open}
                    setOpenSearchBox={() => {}}
                    useNM={box.nm(n) as unknown as NoteManagementState}
                />
            </CssVarsProvider>
        );
        const { rerender } = render(view(true, "u1", 1));
        await settle();
        expect(box.load.mock.calls).toEqual([box.args("u1", 1, "token-1")]);

        // Still loading: a new member and token do not ask a second time.
        auth.accessToken = "token-2";
        rerender(view(true, "u2", 1));
        await settle();
        expect(box.load).toHaveBeenCalledTimes(1);

        // Another task or note does (MIP-2478), with what is current then.
        rerender(view(true, "u2", 2));
        await settle();
        expect(box.load.mock.calls[1]).toEqual(box.args("u2", 2, "token-2"));

        rerender(view(false, "u2", 2));
        rerender(view(true, "u2", 2));
        await settle();
        expect(box.load).toHaveBeenCalledTimes(3);
    });
});

const folder = (folderId: number) =>
    ({ folderId, name: "Folder", tags: [], myRoleId: 2 }) as unknown as TeamNoteFolderTreeNode;

describe("the team folder dialogs", () => {
    it("members: loads once per folder, with the folder shown", async () => {
        const view = (shown: TeamNoteFolderTreeNode | null) => (
            <CssVarsProvider>
                <ModalTeamFolderMembers
                    folder={shown}
                    myself={member("u1")}
                    open={true}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ currentTeam: { isGuest: false }, teamMembers: [] } as never}
                    onChanged={() => {}}
                    onClose={() => {}}
                />
            </CssVarsProvider>
        );
        const { rerender } = render(view(null));
        expect(loads.members).not.toHaveBeenCalled();
        rerender(view(folder(1)));
        await settle();
        // A refreshed folder list: the same folder, a new object.
        rerender(view(folder(1)));
        await settle();
        expect(loads.members.mock.calls).toEqual([[member("u1"), 1, "token-1"]]);

        rerender(view(folder(2)));
        await settle();
        expect(loads.members.mock.calls[1]).toEqual([member("u1"), 2, "token-1"]);
    });

    it("tags: a refreshed folder object keeps what is being typed", async () => {
        const view = (shown: TeamNoteFolderTreeNode) => (
            <CssVarsProvider>
                <ModalTeamFolderTags
                    folder={shown}
                    myself={member("u1")}
                    open={true}
                    onChanged={() => {}}
                    onClose={() => {}}
                />
            </CssVarsProvider>
        );
        const { rerender } = render(view(folder(1)));
        await settle();
        const input = screen.getAllByRole("textbox")[0] as HTMLInputElement;
        fireEvent.change(input, { target: { value: "roadmap" } });

        rerender(view(folder(1)));
        await settle();
        expect(input.value).toBe("roadmap");
        expect(loads.tags).toHaveBeenCalledTimes(1);

        rerender(view(folder(2)));
        await settle();
        expect(input.value).toBe("");
        expect(loads.tags).toHaveBeenCalledTimes(2);
    });
});

describe("a notes sidebar section", () => {
    const view = (isCurrent: boolean) => (
        <CssVarsProvider>
            <NoteTypeSection
                icon={null}
                isCurrent={isCurrent}
                noteType={1}
                title="My Notes"
                useNM={{ setCurrentNoteType: vi.fn() } as never}
            >
                {null}
            </NoteTypeSection>
        </CssVarsProvider>
    );
    const expanded = () =>
        document.querySelector("[aria-expanded]")!.getAttribute("aria-expanded");

    it("opens when the open note arrives, and stays folded once the member folds it", () => {
        const { rerender } = render(view(false));
        expect(expanded()).toBe("false");
        rerender(view(true));
        expect(expanded()).toBe("true");

        fireEvent.click(screen.getByText("My Notes"));
        expect(expanded()).toBe("false");
        rerender(view(true));
        expect(expanded()).toBe("false");
    });
});
