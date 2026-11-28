/**
 * MIP-2549: the stack of faces is a button that opens the members; the modal removes for the
 * creator only, anyone leaves, and a full chat (ten people) says why nobody can be added.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { MDMAvatarButton } from "../components/ui/avatars/MDMAvatarButton";
import { mdmFaces } from "../components/ui/avatars/mdmStack";
import type { AllChatProps } from "../types/chat";

const store = vi.hoisted(() => ({
    channels: new Map<string, unknown>(),
    members: new Map<string, unknown[]>(),
    removeMember: vi.fn(async () => {}),
    addMembers: vi.fn(),
}));

vi.mock("../services/channel/channelService", () => ({
    channelService: {
        getSnapshot: () => ({ channels: store.channels, membersByChannel: store.members }),
        subscribe: () => () => {},
        refreshChannelMembers: vi.fn(async () => true),
        removeMember: store.removeMember,
        addMembers: store.addMembers,
    },
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("../features/chat/components/modals/ModalAddMembers", () => ({
    ModalAddMembers: ({ open }: { open: boolean }) =>
        open ? <div data-testid="add-picker" /> : null,
}));

const CHAT = "c1";
const ids = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? "me" : `u${i}`));

const setUp = (n: number, ownerId = "me") => {
    store.channels = new Map([[CHAT, { id: CHAT, ownerId, kind: 4 }]]);
    store.members = new Map([
        [
            CHAT,
            ids(n).map((id) => ({
                id: `m-${id}`,
                userId: id,
                user: { userName: `Name ${id}`, userEmail: `${id}@x.test` },
            })),
        ],
    ]);
    return {
        chatId: CHAT,
        chatType: 4,
        mdmMembers: ids(n).map((id) => ({ userId: id, userName: `Name ${id}` })),
    } as unknown as AllChatProps;
};

const draw = (chat: AllChatProps, onRowClick = vi.fn()) => {
    render(
        <CssVarsProvider>
            <AvatarContextProvider
                value={
                    {
                        myself: { userId: "me" },
                        setMyself: () => {},
                        teamMemberProfiles: {},
                        socket: null,
                        useCM: {},
                        useUISM: {},
                    } as never
                }
            >
                <div onClick={onRowClick}>
                    <MDMAvatarButton chat={chat} />
                </div>
            </AvatarContextProvider>
        </CssVarsProvider>
    );
    return onRowClick;
};

const open = async () => {
    await act(async () => {
        fireEvent.click(screen.getByTestId("mdm-chip"));
    });
    return screen.getByRole("dialog");
};

beforeEach(() => {
    store.removeMember.mockClear();
});
afterEach(cleanup);

describe("mdmFaces", () => {
    it("shows every face up to three, then two and the rest", () => {
        expect(mdmFaces(1)).toEqual({ faces: 1, overflow: 0 });
        expect(mdmFaces(3)).toEqual({ faces: 3, overflow: 0 });
        expect(mdmFaces(4)).toEqual({ faces: 2, overflow: 2 });
        expect(mdmFaces(10)).toEqual({ faces: 2, overflow: 8 });
    });
});

describe("the chip", () => {
    it("is a named button that opens the members without opening the row behind it", async () => {
        const row = draw(setUp(4));
        const chip = screen.getByRole("button", { name: "Members of this conversation (4)" });
        expect(chip.getAttribute("tabindex")).toBe("0");
        const dialog = await open();
        expect(within(dialog).getByText("4 of 10 people")).toBeTruthy();
        expect(row).not.toHaveBeenCalled();
    });

    it("opens from the keyboard", async () => {
        draw(setUp(3));
        await act(async () => {
            fireEvent.keyDown(screen.getByTestId("mdm-chip"), { key: "Enter" });
        });
        expect(screen.getByRole("dialog")).toBeTruthy();
    });
});

describe("the members modal", () => {
    it("gives the creator a remove button on everyone else", async () => {
        draw(setUp(3));
        await open();
        expect(screen.queryByTestId("remove-member-me")).toBeNull();
        expect(screen.getByTestId("remove-member-u1")).toBeTruthy();
        expect(screen.getByTestId("remove-member-u2")).toBeTruthy();
    });

    it("gives another member no remove button", async () => {
        draw(setUp(3, "u1"));
        await open();
        expect(screen.queryByTestId("remove-member-u1")).toBeNull();
        expect(screen.queryByTestId("remove-member-u2")).toBeNull();
    });

    it("lets any member remove once the creator's account is gone", async () => {
        draw(setUp(3, "someone-deleted"));
        await open();
        expect(screen.getByTestId("remove-member-u1")).toBeTruthy();
    });

    it("adds below ten", async () => {
        draw(setUp(9));
        const dialog = await open();
        const add = within(dialog).getByRole("button", { name: "Add people" });
        expect(add.hasAttribute("disabled")).toBe(false);
        fireEvent.click(add);
        expect(screen.getByTestId("add-picker")).toBeTruthy();
    });

    it("at ten, the add button is off and says why", async () => {
        draw(setUp(10));
        const dialog = await open();
        const add = within(dialog).getByRole("button", { name: "Add people" });
        expect(add.hasAttribute("disabled")).toBe(true);
        const note = document.getElementById(add.getAttribute("aria-describedby")!);
        expect(note?.textContent).toBe(
            "This conversation has the maximum of 10 people. Remove someone to add another."
        );
    });

    it("leaves after a confirmation", async () => {
        draw(setUp(3));
        const dialog = await open();
        fireEvent.click(within(dialog).getByRole("button", { name: "Leave conversation" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Leave" }));
        });
        expect(store.removeMember).toHaveBeenCalledWith(CHAT, 4, "me");
    });
});
