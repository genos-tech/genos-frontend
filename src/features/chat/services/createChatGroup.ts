/**
 * v3 GM create flow. Replaces the legacy chain of
 * `createGMChat` (REST) + `socket.emit("join")` + `socket.emit("message")`
 * + `gm_members_added` with a single `channelService.createChannel`.
 *
 * Behavior changes from legacy (decided 2026-05-30):
 *   - No system "has created group" bubble is posted. Channel opens
 *     empty; first user message is the first bubble.
 *   - `allChats` updates flow from the v3 `channel.created` broadcast
 *     into `channelService.snapshot.channels` and the existing v3
 *     subscription in `useChatManagement.funcSetAllChats`. We only
 *     navigate locally via `setCurrentMainChat`.
 *
 * Returned value: the created Channel (or undefined on failure) so the
 * caller can react accordingly. Modal closing / error messaging stays
 * the caller's responsibility.
 */

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { Channel, ChannelKind } from "../../../types/channel";
import { ChatProps } from "../../../types/chat";
import { defaultDmPartner } from "./constants";

/**
 * Build a minimal `ChatProps` row pointing at the freshly created v3
 * channel. The full chat-pane state (members, messages, etc.) hydrates
 * from `channelService.syncChannel` on the chat-open path; here we just
 * need enough for the pane to render without a placeholder flicker.
 */
function channelToInitialChat(channel: Channel, chatType: number): ChatProps {
    return {
        chatId: channel.id,
        chatName: channel.title || "",
        chatType,
        dmPartnerUser: defaultDmPartner,
        isPrivate: channel.isPrivate,
        lastReadMessageId: "",
        latestMessage: undefined as unknown as ChatProps["latestMessage"],
        latestMessageText: "",
        messages: [],
        profileImagePath: channel.profileImageUrl || undefined,
        TSLastMessage: channel.tsUpdated ?? channel.tsCreated ?? "",
    };
}

export const createChatGroup = async (
    myself: UserProps,
    chatName: string,
    useCM: ChatManagementState,
    setCreateCGErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    setGroupName: (e: string) => void,
    isPrivate: boolean,
    selectedMemberIds: string[] = []
): Promise<Channel | undefined> => {
    const trimmedName = chatName.trim();
    if (!trimmedName) {
        setCreateCGErrorMessage("Group name is required.");
        return undefined;
    }

    try {
        const channel = await channelService.createChannel({
            isPrivate,
            kind: ChannelKind.GM,
            memberUserIds: selectedMemberIds,
            teamId: myself.teamId,
            title: trimmedName,
        });

        if (!channel) {
            setCreateCGErrorMessage("Failed to create group. Please try again.");
            return undefined;
        }

        useCM.setCurrentMainChat(channelToInitialChat(channel, 2));
        setOpen(false);
        setCreateCGErrorMessage("");
        setGroupName("");
        return channel;
    } catch (error) {
        console.error("Failed to create GM:", error);
        setCreateCGErrorMessage("Failed to create group. Please try again.");
        return undefined;
    }
};
