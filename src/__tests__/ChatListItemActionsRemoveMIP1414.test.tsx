/**
 * MIP-1414: the chat row's "..." menu offers "Remove from sidebar" and "Delete all my messages and
 * remove" for a DM (type 1) and an MDM (type 4), and neither for a group chat.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatListItemActions } from "../features/chat/components/sidebar/ChatListItemActions";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

const hideChannel = vi.fn();
vi.mock("../services/channel/channelService", () => ({
    channelService: { hideChannel: (id: string) => hideChannel(id) },
}));
vi.mock("../context/AuthContext", () => ({
    useOptionalAccessToken: () => "token",
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: {
        success: (m: string) => toastSuccess(m),
        error: (m: string) => toastError(m),
    },
}));

afterEach(() => {
    cleanup();
    hideChannel.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
});

const mount = (chatType: number) => {
    const chat = {
        chatId: "c1",
        chatType,
        isPinned: false,
        dmPartnerUser: { userId: "u2" },
    } as unknown as AllChatProps;
    render(
        <CssVarsProvider>
            <ChatListItemActions
                chat={chat}
                incompleteTodoCount={0}
                isPinned={false}
                isToDoVisible={false}
                myself={{ userId: "u1", customStatus: "" } as UserProps}
                setIsToDoVisible={vi.fn()}
                onPinClick={vi.fn()}
                onSplitClick={vi.fn()}
            />
        </CssVarsProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: en.common.ui.moreMenu.ariaLabel }));
};

describe("chat row menu: remove from sidebar", () => {
    it.each([1, 4])("shows both options for chat type %i", async (type) => {
        mount(type);
        expect(await screen.findByText(en.chat.listItem.removeFromSidebar)).toBeTruthy();
        expect(screen.getByText(en.common.forceDelete.myMessagesMenu)).toBeTruthy();
    });

    it("shows neither for a group chat", () => {
        mount(2);
        expect(screen.queryByText(en.chat.listItem.removeFromSidebar)).toBeNull();
        expect(screen.queryByText(en.common.forceDelete.myMessagesMenu)).toBeNull();
    });

    it("hides the chat without any confirmation and says a new message brings it back", async () => {
        hideChannel.mockResolvedValue(undefined);
        mount(1);
        fireEvent.click(await screen.findByText(en.chat.listItem.removeFromSidebar));
        await waitFor(() => expect(hideChannel).toHaveBeenCalledWith("c1"));
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(en.chat.listItem.removedFromSidebar)
        );
        expect(en.chat.listItem.removedFromSidebar).toMatch(/new message/i);
    });

    it("tells the person when the removal was refused and the chat is back", async () => {
        hideChannel.mockRejectedValue(new Error("no"));
        mount(1);
        fireEvent.click(await screen.findByText(en.chat.listItem.removeFromSidebar));
        await waitFor(() =>
            expect(toastError).toHaveBeenCalledWith(en.chat.listItem.removeFromSidebarFailed)
        );
    });
});
