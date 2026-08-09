/**
 * v3 MDM create flow. Replaces the legacy
 * `createMDMChat` (REST) + `socket.emit("join")` + `socket.emit("message")`
 * + manual `addChat/addMessage` IDB plumbing with a single
 * `channelService.createChannel` call.
 *
 * Idempotency: the v3 backend (`_create_group`) does NOT dedupe MDM
 * channels by member set the way `_create_dm` does via
 * `ChannelDirectPair`. To preserve the legacy "open the existing MDM
 * instead of creating a duplicate" UX, we scan
 * `channelService.snapshot.channels` for an MDM whose member roster
 * matches exactly before issuing `createChannel`.
 *
 * Behavior changes from legacy (decided 2026-05-30):
 *   - No system "started conversation" bubble is posted. The MDM opens
 *     empty; first user message is the first bubble.
 *   - `allChats` updates flow from the v3 `channel.created` broadcast
 *     into `channelService.snapshot.channels` and the existing v3
 *     subscription. We only navigate locally via `setCurrentMainChat`.
 */

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { Channel, ChannelKind, ChannelMember } from "../../../types/channel";
import { ChatProps } from "../../../types/chat";
import { defaultDmPartner } from "./constants";

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

/**
 * Find an existing MDM channel whose member set exactly matches
 * `targetMemberIds` (which already includes the creator). Returns the
 * channel UUID, or `null` when no match is found.
 *
 * The roster scan is bounded by `snapshot.channels.size` — small in
 * practice (per-team count). Member roster comparison uses Set equality
 * so order/duplicates in the input don't affect the result.
 */
function findExistingMdm(targetMemberIds: ReadonlySet<string>): string | null {
    const snapshot = channelService.getSnapshot();
    for (const channel of snapshot.channels.values()) {
        if (channel.kind !== ChannelKind.MDM) continue;
        const roster = snapshot.membersByChannel.get(channel.id) ?? [];
        if (roster.length !== targetMemberIds.size) continue;
        const ids = new Set(roster.map((m: ChannelMember) => m.userId));
        if (ids.size !== targetMemberIds.size) continue;
        let allMatch = true;
        for (const id of targetMemberIds) {
            if (!ids.has(id)) {
                allMatch = false;
                break;
            }
        }
        if (allMatch) return channel.id;
    }
    return null;
}

export const createMDMChatGroup = async (
    myself: UserProps,
    memberIds: string[],
    useCM: ChatManagementState,
    setErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void
): Promise<Channel | undefined> => {
    const messages = getMessages().chat.errors;
    // Build the canonical member set (creator included). The v3 backend
    // drops the creator from `member_user_ids` server-side and re-adds
    // them as owner, but the dedup scan compares against the *roster*
    // which always contains the creator.
    const targetMemberIds = new Set<string>(memberIds.filter(Boolean));
    targetMemberIds.add(myself.userId);
    if (targetMemberIds.size < 3) {
        setErrorMessage(messages.mdmMinimumMembers);
        return undefined;
    }

    try {
        // FE-side idempotency scan. If an MDM with the same members
        // already exists in this session's snapshot, open it instead.
        const existingChannelId = findExistingMdm(targetMemberIds);
        if (existingChannelId) {
            const snapshot = channelService.getSnapshot();
            const existing = snapshot.channels.get(existingChannelId);
            if (existing) {
                useCM.setCurrentMainChat(channelToInitialChat(existing, 4));
                useCM.setCurrentChatPaneType(1);
                useCM.setIsMainChatVisible(true);
                setOpen(false);
                setErrorMessage("");
                return existing;
            }
        }

        const channel = await channelService.createChannel({
            kind: ChannelKind.MDM,
            memberUserIds: [...targetMemberIds].filter((id) => id !== myself.userId),
            teamId: myself.teamId,
        });
        if (!channel) {
            setErrorMessage(messages.createMdmFailed);
            return undefined;
        }

        useCM.setCurrentMainChat(channelToInitialChat(channel, 4));
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);
        setErrorMessage("");
        return channel;
    } catch (error) {
        console.error("Failed to create MDM:", error);
        setErrorMessage(messages.createMdmFailed);
        return undefined;
    }
};
