/**
 * v3 add-members flow. Replaces the legacy `/mdm/join/` REST chain and
 * the legacy `createMDMChat` → `socket.emit("message")` DM-to-MDM
 * conversion with `channelService.addMembers` and
 * `channelService.createChannel`.
 *
 * Behavior changes from legacy (decided 2026-05-30):
 *   - DM-to-MDM conversion drops the system "started conversation"
 *     bubble. The MDM opens empty.
 *   - MDM dedup uses the FE-side member-set scan in
 *     `createMDMChatGroup.findExistingMdm` (kept colocated there since
 *     it's the canonical "have we already got this MDM?" check).
 *
 * Local-state updates: the v3 `channel.member.add` broadcast updates
 * `channelService.snapshot.membersByChannel`, which feeds `allChats`
 * via the existing `useChatManagement` subscription chain. So we do
 * NOT manually patch `useCM.setAllChats` / `useCM.setCurrentMainChat`
 * for the member roster — v3 does it. We only navigate.
 */

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { Channel, ChannelKind, ChannelMember } from "../../../types/channel";
import { AllChatProps, ChatProps } from "../../../types/chat";
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
 * Scan `channelService.snapshot.channels` for an MDM whose roster
 * matches `targetMemberIds` exactly. Mirrors the helper in
 * `createMDMChatGroup.ts` (kept here as a private copy so this file's
 * MDM-dedup intent reads inline — the two would naturally consolidate
 * if/when more callers need the scan).
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

/**
 * Add members to an existing MDM via v3. Idempotent against re-adding
 * an already-present member (the backend collapses duplicates).
 */
export const addMembersToMDM = async (
    channelId: string,
    memberIds: string[]
): Promise<boolean> => {
    try {
        const result = await channelService.addMembers(channelId, memberIds);
        return !!result;
    } catch (error) {
        console.error("Failed to add members to MDM:", error);
        return false;
    }
};

/**
 * Convert a DM into an MDM by creating a new MDM channel with the DM
 * partner + the newly selected members. v3 backend doesn't dedupe MDMs
 * by member set, so we scan the snapshot first.
 */
export const convertDMToMDM = async (
    myself: UserProps,
    dmPartnerId: string,
    newMemberIds: string[],
    useCM: ChatManagementState,
    setErrorMessage: (msg: string) => void,
    setOpen: (open: boolean) => void
): Promise<Channel | null> => {
    const targetMemberIds = new Set<string>([
        myself.userId,
        dmPartnerId,
        ...newMemberIds.filter(Boolean),
    ]);
    if (targetMemberIds.size < 3) {
        setErrorMessage("MDM requires at least 3 distinct members.");
        return null;
    }

    try {
        const existingChannelId = findExistingMdm(targetMemberIds);
        if (existingChannelId) {
            const snapshot = channelService.getSnapshot();
            const existing = snapshot.channels.get(existingChannelId);
            if (existing) {
                useCM.setCurrentMainChat(channelToInitialChat(existing, 4));
                useCM.setCurrentChatPaneType(1);
                useCM.setIsMainChatVisible(true);
                setOpen(false);
                return existing;
            }
        }

        const channel = await channelService.createChannel({
            kind: ChannelKind.MDM,
            memberUserIds: [...targetMemberIds].filter((id) => id !== myself.userId),
            teamId: myself.teamId,
        });
        if (!channel) {
            setErrorMessage("Failed to create multi-user DM. Please try again.");
            return null;
        }

        useCM.setCurrentMainChat(channelToInitialChat(channel, 4));
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);
        return channel;
    } catch (error) {
        console.error("Failed to convert DM to MDM:", error);
        setErrorMessage("Failed to add members. Please try again.");
        return null;
    }
};

/**
 * Dispatcher invoked by ModalAddMembers. DM → convert to MDM, MDM →
 * add members. PM/GM/other types: ignored (UI doesn't surface the
 * "add members" affordance for them today).
 */
export const addMembersToChat = async (
    myself: UserProps,
    chat: AllChatProps,
    newMemberIds: string[],
    useCM: ChatManagementState,
    setErrorMessage: (msg: string) => void,
    setOpen: (open: boolean) => void
): Promise<boolean> => {
    if (chat.chatType === 1) {
        const dmPartner = chat.dmPartnerUser;
        const result = await convertDMToMDM(
            myself,
            dmPartner.userId,
            newMemberIds,
            useCM,
            setErrorMessage,
            setOpen
        );
        return result !== null;
    }
    if (chat.chatType === 4) {
        const success = await addMembersToMDM(chat.chatId, newMemberIds);
        if (success) {
            setOpen(false);
            return true;
        }
        setErrorMessage("Failed to add members. Please try again.");
        return false;
    }
    return false;
};
