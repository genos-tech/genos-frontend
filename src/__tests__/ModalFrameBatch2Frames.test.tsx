/**
 * MIP-1126 batch 2: the rendered frames of the create / manage dialogs that
 * can be mounted with small props. Each is a ModalFrame dialog with the
 * right name, the right layer and a flat surface (no gradient, one shadow).
 * Layers are asserted from the modal root (`role="presentation"`), the thing
 * that carries the z-index.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ModalTransferOwner } from "../components/ui/misc/ModalTransferOwner";
import { PROFILE_MODAL_Z_INDEX } from "../components/ui/styles/commonStyle";
import { ModalInviteMembers } from "../features/admin/components/modals/ModalInviteMembers";
import { ModalManageProjectLabels } from "../features/admin/components/projectLabels/ModalManageProjectLabels";
import { ModalAssignGMTags } from "../features/chat/components/modals/ModalAssignGMTags";
import { ModalJoinGM } from "../features/chat/components/modals/ModalJoinGM";
import { ModalManageGMTags } from "../features/chat/components/modals/ModalManageGMTags";
import { ModalManageTodoTags } from "../features/chat/components/todo/ModalManageTodoTags";
import { TodoHostLayerProvider } from "../features/chat/components/todo/TodoHostLayer";
import { ModalJoinProject } from "../features/tasks/components/modals/ModalJoinProject";
import { ModalManageCustomFields } from "../features/tasks/components/modals/ModalManageCustomFields";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../hooks/common/usePersonalGMTags", () => ({
    usePersonalGMTags: () => ({
        tags: [],
        assignmentsByChannelId: {},
        defaultVisibleTagIds: [],
        loaded: true,
        createTag: vi.fn(),
        updateTag: vi.fn(),
        deleteTag: vi.fn(),
        setChannelTags: vi.fn(),
    }),
}));
vi.mock("../features/admin/services/projectLabels", () => ({
    assignProjectLabels: vi.fn(),
    createProjectLabel: vi.fn(),
    deleteProjectLabel: vi.fn(),
    loadTeamProjectLabels: vi.fn(async () => []),
    updateProjectLabel: vi.fn(),
}));
vi.mock("../hooks/tasks/useProjectCustomFields", () => ({
    refreshProjectCustomFields: vi.fn(),
    useProjectCustomFields: () => ({ fields: [], refresh: vi.fn() }),
}));

const myself = { userId: "u1", userName: "Me", teamId: "t1" } as UserProps;

const wrap = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

/** The dialog, its title text, its layer and its flat-surface facts. */
const facts = () => {
    const dialog = screen.getByRole("dialog");
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent;
    const layer = getComputedStyle(screen.getByRole("presentation")).zIndex;
    const css = cssOf(dialog);
    return {
        title,
        layer,
        gradient: /gradient/i.test(css),
        shadows: css.match(/box-shadow:[^;]*/g),
        radius: css.match(/border-radius:[^;]*/g),
    };
};

const FLAT = { gradient: false, shadows: ["box-shadow: var(--g-shadow-lg)"] };

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("join dialogs", () => {
    it("Join Project: a flat frame at 10010, public wording", () => {
        wrap(
            <ModalJoinProject
                myself={myself}
                setOpenJoinProject={vi.fn()}
                socket={null}
                useCM={{} as never}
                usePM={{} as never}
                openJoinProject={{
                    flag: true,
                    projectId: 3,
                    projectName: "Roadmap",
                    isPrivate: false,
                    systemUserId: "s",
                }}
            />
        );
        expect(facts()).toMatchObject({ title: "Join Project", layer: "10010", ...FLAT });
        expect(screen.getByText("Roadmap")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    });

    it("Join Project (private): asks to join and offers to send the request", () => {
        wrap(
            <ModalJoinProject
                myself={myself}
                setOpenJoinProject={vi.fn()}
                socket={null}
                useCM={{} as never}
                usePM={{} as never}
                openJoinProject={{
                    flag: true,
                    projectId: 3,
                    projectName: "Secret",
                    isPrivate: true,
                    systemUserId: "s",
                }}
            />
        );
        expect(facts().layer).toBe("10010");
        expect(screen.getByRole("button", { name: /Send/i })).toBeTruthy();
    });

    it("Join Project: Cancel and the X both reset the request state", () => {
        const set = vi.fn();
        wrap(
            <ModalJoinProject
                myself={myself}
                setOpenJoinProject={set}
                socket={null}
                useCM={{} as never}
                usePM={{} as never}
                openJoinProject={{
                    flag: true,
                    projectId: 3,
                    projectName: "Roadmap",
                    isPrivate: false,
                    systemUserId: "s",
                }}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(set).toHaveBeenCalledTimes(2);
        expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ flag: false }));
    });

    it("Request to Join (group): a flat frame at 10010 with the group name", () => {
        wrap(
            <ModalJoinGM
                myself={myself}
                openJoinGM={{ flag: true, chatId: "c1", chatName: "Design review" }}
                setOpenJoinGM={vi.fn()}
                socket={null}
            />
        );
        expect(facts()).toMatchObject({ title: "Request to Join", layer: "10010", ...FLAT });
        expect(screen.getByText("Design review")).toBeTruthy();
    });
});

describe("Transfer ownership", () => {
    const candidates = [
        { userId: "u2", userName: "Ally", userEmail: "ally@x.io" },
        { userId: "u3", userName: "Bo", userEmail: "bo@x.io" },
    ];

    it("is a flat danger-tone frame at 10010 with a selectable member list", async () => {
        const onConfirm = vi.fn(async () => true);
        wrap(
            <ModalTransferOwner
                candidates={candidates}
                description="Pick the new owner"
                title="Transfer ownership?"
                open
                onCancel={vi.fn()}
                onConfirm={onConfirm}
            />
        );
        expect(facts()).toMatchObject({ title: "Transfer ownership?", layer: "10010", ...FLAT });
        const confirm = screen
            .getAllByRole("button")
            .find((b) => b.className.includes("colorDanger"))!;
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByText("Ally"));
        expect((confirm as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(confirm);
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("u2"));
    });
});

describe("Invite members", () => {
    it("is a flat frame at 10010; the guest title names the project", () => {
        wrap(
            <ModalInviteMembers
                projectId={4}
                projectName="Roadmap"
                teamId="t1"
                open
                onClose={vi.fn()}
            />
        );
        const f = facts();
        expect(f).toMatchObject({ layer: "10010", ...FLAT });
        expect(f.title).toMatch(/Roadmap/);
        // Send is disabled until an address is entered
        expect((screen.getByRole("button", { name: /Send/i }) as HTMLButtonElement).disabled).toBe(
            true
        );
    });

    it("an address becomes a chip and enables Send", () => {
        wrap(<ModalInviteMembers teamId="t1" open onClose={vi.fn()} />);
        const input = screen.getByRole("textbox");
        fireEvent.change(input, { target: { value: "new@person.io" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(screen.getByText("new@person.io")).toBeTruthy();
        expect((screen.getByRole("button", { name: /Send/i }) as HTMLButtonElement).disabled).toBe(
            false
        );
    });
});

describe("tag dialogs", () => {
    it("Manage tags (group chats): flat frame at 10010", () => {
        wrap(<ModalManageGMTags setOpen={vi.fn()} open />);
        expect(facts()).toMatchObject({ title: "Manage tags", layer: "10010", ...FLAT });
    });

    it("Manage tags: the X closes it", () => {
        const setOpen = vi.fn();
        wrap(<ModalManageGMTags setOpen={setOpen} open />);
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(setOpen).toHaveBeenCalledWith(false);
    });

    it("Assign tags: flat frame at 10010, Save and Cancel in the footer", () => {
        wrap(
            <ModalAssignGMTags
                chat={{ chatId: "c1", chatName: "Design" } as never}
                setOpen={vi.fn()}
                open
            />
        );
        const f = facts();
        expect(f).toMatchObject({ layer: "10010", ...FLAT });
        expect(f.title).toMatch(/Design/);
        expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    const todoModal = () => (
        <ModalManageTodoTags
            categories={[]}
            open
            onClose={vi.fn()}
            onCreate={vi.fn()}
            onDelete={vi.fn()}
            onUpdate={vi.fn()}
        />
    );

    it("To-do tags on the page: 10010", () => {
        wrap(todoModal());
        expect(facts()).toMatchObject({ layer: "10010", ...FLAT });
    });

    it("To-do tags inside the to-do modal: opens above its host (host + 10)", () => {
        wrap(<TodoHostLayerProvider value={10020}>{todoModal()}</TodoHostLayerProvider>);
        expect(facts().layer).toBe("10030");
    });

    it("To-do tags keep their own close name", () => {
        wrap(todoModal());
        expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });
});

describe("project tags (labels)", () => {
    it("sits one above the profile modal that opens it, flat", async () => {
        wrap(
            <ModalManageProjectLabels
                assignedLabels={[]}
                projectId={1}
                teamId="t1"
                open
                onAssignedChange={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(facts()).toMatchObject({
            title: "Project tags",
            layer: String(PROFILE_MODAL_Z_INDEX + 1),
            ...FLAT,
        });
    });
});

describe("custom fields", () => {
    it("page-hosted: 10010", () => {
        wrap(<ModalManageCustomFields projectId={1} open onClose={vi.fn()} />);
        expect(facts()).toMatchObject({ title: "Manage Custom Fields", layer: "10010", ...FLAT });
    });

    it("hosted by a preview at 10020: opens at host + 10 so it is not trapped behind it", () => {
        wrap(<ModalManageCustomFields hostZIndex={10020} projectId={1} open onClose={vi.fn()} />);
        expect(facts().layer).toBe("10030");
    });
});
