/**
 * v3 Channel/Message → legacy ChatProps adapter.
 *
 * Bridges the v3 unified channel/message schema back to the legacy
 * UI's `AllChatProps` / `MessageProps` shapes so existing UI surfaces
 * (MainChatPane, ChatHome, sidebar) keep rendering unchanged while
 * their data sources flip over to the v3 backend.
 *
 * The chatId migration: the v3 `Channel.id` is a UUID string; legacy
 * `ChatProps.chatId` was an integer. We dropped the integer constraint
 * (see types/chat.ts) so the UUID flows through verbatim. Call sites
 * that did arithmetic / IDB-int-keying on chatId now surface as tsc
 * errors — that error list IS the punch list for follow-on sessions.
 *
 * Scope intentionally narrow: this adapter handles only the chat-list
 * use case (AllChatProps). Per-channel detail with full message lists,
 * thread bridges, and the activity stream stay on their existing paths
 * for now.
 */

import type { UserProps } from "../../../types/admin";
import {
    ChannelKind,
    type Channel,
    type ChannelMember,
    type Message,
} from "../../../types/channel";
import type { AllChatProps, MessageProps } from "../../../types/chat";

/** Map v3 `ChannelKind` to the legacy integer kind code. They happen
 *  to be the same integer values today (DM=1, GM=2, PM=3, MDM=4) —
 *  centralized here so a future divergence is one place to fix. */
const KIND_TO_CHAT_TYPE: Record<ChannelKind, number> = {
    [ChannelKind.DM]: 1,
    [ChannelKind.GM]: 2,
    [ChannelKind.PM]: 3,
    [ChannelKind.MDM]: 4,
};

/** A best-effort empty user — used for `dmPartnerUser` on non-DM
 *  channels (the legacy shape requires the field but UI code reads
 *  it only on DM). When the v3 store has the channel member roster
 *  in memory, the DM branch of the adapter swaps the right partner
 *  in by inspecting members. */
const EMPTY_USER: UserProps = {
    userId: "",
    userName: "",
    userEmail: "",
    teamId: "",
    teamName: "",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
};

/**
 * Resolve the DM partner from the channel's member list. For DM
 * channels, this is the *other* user in the pair. Returns
 * EMPTY_USER when the partner can't be located (no roster cached
 * yet, or the channel isn't a DM).
 */
function resolveDmPartner(
    members: readonly ChannelMember[] | undefined,
    currentUserId: string | null
): UserProps {
    if (!members || !currentUserId) return EMPTY_USER;
    const partner = members.find((m) => m.userId !== currentUserId);
    if (!partner) return EMPTY_USER;
    // The v3 ChannelMember row only carries `userId / role / tsJoined`.
    // Display name + avatar live on the user model and aren't joined
    // into the member rows today. PUNCH LIST: extend `ChannelMember`
    // (or expose a parallel user-cache off channelService) so the DM
    // partner's name can resolve here. Until then we return a row
    // with only the userId populated — the existing DM rendering
    // resolves name via the team-member directory anyway.
    return {
        userId: partner.userId,
        userName: "",
        userEmail: "",
        teamId: "",
        teamName: "",
        avatarImgPath: "",
        tsLastSeen: "",
        tsJoined: partner.tsJoined ?? "",
    };
}

/**
 * Adapter for the chat list's `latestMessage` slot. The legacy
 * `MessageProps` shape carries integer ids that the v3 backend
 * doesn't have direct equivalents for — we leave those as a tsc
 * inventory item rather than fabricating fake integers (see
 * `messageId: 0` placeholder below). Real per-channel message lists
 * are migrated in follow-on sessions and will need MessageProps to
 * flip to string ids the same way ChatProps did.
 */
function v3MessageToLegacyPreview(m: Message): MessageProps {
    return {
        chatType: KIND_TO_CHAT_TYPE[m.channelKind as ChannelKind] ?? 0,
        // PUNCH LIST: MessageProps.chatId is still typed `number`.
        // tsc surfaces this — fix when MessageProps migrates.
        chatId: 0,
        messageId: m.seq ?? 0,
        content: m.body ?? [],
        contentText: m.bodyText ?? "",
        sender: {
            userId: m.sender?.userId ?? "",
            userName: m.sender?.userName ?? "",
            userEmail: m.sender?.userEmail ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: m.sender?.avatarImgPath ?? "",
            tsLastSeen: "",
            tsJoined: "",
        },
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        numReplies: m.replyCount ?? 0,
        taskExist: false,
        taskId: null,
        taskStatus: null,
    };
}

/**
 * Empty latestMessage stub for a channel that has no messages yet.
 * The legacy shape requires `latestMessage` to be present (not
 * optional), so we fabricate a structurally-valid empty row.
 * `tsSent` is set to the channel's creation time so sort-by-recency
 * still places freshly-created channels reasonably.
 */
function emptyLatestMessage(channel: Channel): MessageProps {
    return {
        chatType: KIND_TO_CHAT_TYPE[channel.kind] ?? 0,
        chatId: 0,
        messageId: 0,
        content: [],
        contentText: "",
        sender: EMPTY_USER,
        tsSent: channel.tsCreated ?? "",
        tsUpdated: channel.tsUpdated ?? "",
        numReplies: 0,
        taskExist: false,
        taskId: null,
        taskStatus: null,
    };
}

/**
 * Convert one v3 Channel into a legacy AllChatProps row.
 *
 * `members` is the cached roster from `channelService.snapshot.
 * membersByChannel.get(channel.id)`. Pass it (or undefined) — the
 * adapter falls back to EMPTY_USER for DM partners when absent.
 *
 * `isPinned` is the boolean readout of
 * `channelService.snapshot.pinByChannelId.has(channel.id)` — kept as
 * a parameter so the caller can batch the pin-map lookup once instead
 * of resubscribing inside the adapter for every row.
 *
 * `currentUserId` is the viewer's user id; needed for DM partner
 * resolution. Pass `null` if pre-auth — the adapter will safely
 * return EMPTY_USER.
 */
export function channelToLegacyChat(args: {
    channel: Channel;
    members?: readonly ChannelMember[];
    isPinned: boolean;
    currentUserId: string | null;
}): AllChatProps {
    const { channel, members, isPinned, currentUserId } = args;
    const latest = channel.latestMessage
        ? v3MessageToLegacyPreview(channel.latestMessage)
        : emptyLatestMessage(channel);
    return {
        chatType: KIND_TO_CHAT_TYPE[channel.kind] ?? 0,
        chatId: channel.id,
        chatName: channel.title || "",
        dmPartnerUser:
            channel.kind === ChannelKind.DM
                ? resolveDmPartner(members, currentUserId)
                : EMPTY_USER,
        // PUNCH LIST: lastReadMessageId in the legacy shape was the
        // integer message id. v3 carries a `ReadCursor` keyed on the
        // message UUID. Until the cursor migrates too, we emit empty
        // string — consumers that read this value get a stable no-op
        // and the unread-count derivation in useChatManagement bails
        // out cleanly.
        lastReadMessageId: "",
        latestMessage: latest,
        latestMessageText: latest.contentText,
        TSLastMessage: latest.tsSent,
        isPrivate: channel.isPrivate,
        profileImagePath: channel.profileImageUrl || undefined,
        isPinned,
        // PM channels carry `project` on the legacy shape. v3 stores
        // `projectId` on the channel; resolving the full ProjectProps
        // is its own migration step.
        project: undefined,
        // MDM members come from the v3 channel member roster but the
        // legacy `mdmMembers` shape is slightly different. Leaving
        // undefined for now — MDM rendering paths get reconciled in
        // a later session.
        mdmMembers: undefined,
    };
}

/**
 * Map a snapshot of v3 channels to the legacy `AllChatProps[]`. The
 * input is the values of `channelService.snapshot.channels`; the
 * caller supplies the `pinByChannelId` and `membersByChannel`
 * lookups so the adapter doesn't need a service reference.
 *
 * Sort: recency desc on `latestMessage.tsSent` (falling back to
 * `tsUpdated`) — mirrors the legacy `sortByTSLastMessageDesc` order.
 */
export function v3ChannelsToLegacyChats(args: {
    channels: Iterable<Channel>;
    pinByChannelId: ReadonlySet<string> | { has(id: string): boolean };
    membersByChannel: ReadonlyMap<string, readonly ChannelMember[]>;
    currentUserId: string | null;
}): AllChatProps[] {
    const { channels, pinByChannelId, membersByChannel, currentUserId } = args;
    const out: AllChatProps[] = [];
    for (const c of channels) {
        out.push(
            channelToLegacyChat({
                channel: c,
                members: membersByChannel.get(c.id),
                isPinned: pinByChannelId.has(c.id),
                currentUserId,
            })
        );
    }
    out.sort((a, b) => {
        const ta = a.TSLastMessage || "";
        const tb = b.TSLastMessage || "";
        return tb.localeCompare(ta);
    });
    return out;
}
