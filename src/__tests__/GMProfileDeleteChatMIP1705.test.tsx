/**
 * MIP-1705: a group's owner cannot leave it, so the group profile offers the owner "Delete group"
 * instead, and nobody else. The dialog sends the chosen mode to the service, and the modal closes
 * once it is done.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalGMProfile } from "../features/chat/components/modals/ModalGMProfile";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token" }),
    useOptionalAccessToken: () => "token",
}));

const CHANNEL_ID = "11111111-1111-4111-8111-111111111111";
const snapshot = {
    channels: new Map([
        [
            CHANNEL_ID,
            {
                id: CHANNEL_ID,
                title: "Launch crew",
                ownerId: "u-owner",
                legacyChatId: 42,
                isPrivate: false,
                isExternal: false,
                profileImageUrl: "",
                tsCreated: "2026-01-02T03:04:05Z",
            },
        ],
    ]),
    membersByChannel: new Map([
        [
            CHANNEL_ID,
            [
                {
                    userId: "u-owner",
                    memberRole: "owner",
                    tsJoined: "2026-01-02T03:04:05Z",
                    user: { userName: "Ada", userEmail: "ada@example.com", avatarImgPath: "" },
                },
                {
                    userId: "u-me",
                    memberRole: "member",
                    tsJoined: "2026-01-02T03:04:05Z",
                    user: { userName: "Bo", userEmail: "bo@example.com", avatarImgPath: "" },
                },
            ],
        ],
    ]),
};

const deleteChannel = vi.fn();
vi.mock("../services/channel/channelService", () => ({
    channelService: {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
        refreshChannelMembers: () => Promise.resolve(),
        syncChannel: () => Promise.resolve(),
        deleteChannel: (...a: unknown[]) => deleteChannel(...a),
    },
}));

vi.mock("../components/ui/avatars/AvatarContext", () => ({
    useUserProfile: () => ({ userName: "Ada", userEmail: "ada@example.com" }),
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <div />,
}));
vi.mock("../components/ui/memberRoles/MemberRoleControl", () => ({
    MemberRoleControl: () => <div />,
}));
vi.mock("../features/chat/components/modals/ExternalSharesPanel", () => ({
    ExternalSharesPanel: () => <div />,
}));
vi.mock("../features/chat/components/modals/ModalAddMembers", () => ({
    ModalAddMembers: () => null,
}));
vi.mock("../features/chat/utils/channelIdResolvers", () => ({
    resolveLegacyChatId: () => 42,
}));

const copy = en.common.deleteChat;
const gmChat = { chatId: CHANNEL_ID, chatType: 2, chatName: "Launch crew" } as AllChatProps;

const renderModal = (userId: string, setOpen = vi.fn()) =>
    render(
        <CssVarsProvider>
            <ModalGMProfile
                gmChat={gmChat}
                myself={{ userId, teamId: "t-1", teamName: "Team" } as UserProps}
                openModalGMProfile={true}
                setAvatarUserId={vi.fn()}
                setMyself={vi.fn()}
                setOpenModalGMProfile={setOpen}
                setOpenUserProfile={vi.fn()}
                socket={null}
                useCM={{ allChats: [], funcSetAllChats: vi.fn(), setAllChats: vi.fn() } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("the group profile's delete button", () => {
    beforeEach(() => {
        deleteChannel.mockReset();
        deleteChannel.mockResolvedValue(undefined);
    });

    it("is offered to the owner, who has no Leave", async () => {
        renderModal("u-owner");

        expect(await screen.findByRole("button", { name: copy.button })).toBeTruthy();
        expect(screen.queryByRole("button", { name: en.common.actions.leave })).toBeNull();
    });

    it("is not offered to anyone else, who has Leave", async () => {
        renderModal("u-me");

        expect(await screen.findByRole("button", { name: en.common.actions.leave })).toBeTruthy();
        expect(screen.queryByRole("button", { name: copy.button })).toBeNull();
    });

    it("confirming a soft delete calls the service for this group and closes the modal", async () => {
        const setOpen = vi.fn();
        renderModal("u-owner", setOpen);

        fireEvent.click(await screen.findByRole("button", { name: copy.button }));
        fireEvent.click(await screen.findByRole("button", { name: copy.confirmSoft }));

        await waitFor(() => expect(deleteChannel).toHaveBeenCalledWith(CHANNEL_ID, "soft"));
        await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    });

    it("a refused delete keeps the modal open and says so", async () => {
        deleteChannel.mockRejectedValue(new Error("forbidden"));
        const setOpen = vi.fn();
        renderModal("u-owner", setOpen);

        fireEvent.click(await screen.findByRole("button", { name: copy.button }));
        fireEvent.click(await screen.findByRole("button", { name: copy.confirmSoft }));

        await waitFor(() => expect(screen.getByText(copy.genericError)).toBeTruthy());
        expect(setOpen).not.toHaveBeenCalledWith(false);
    });
});
