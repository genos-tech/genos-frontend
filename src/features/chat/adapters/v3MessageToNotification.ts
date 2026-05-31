/**
 * Adapter: v3 `Message` (live socket payload) → legacy
 * `NewMessageProps` / `NewThreadMessageProps` so the existing
 * `buildChatIntent` / `buildThreadIntent` notification routers can
 * reuse all their downstream icon / title / category logic.
 *
 * We resolve the channel + member context from `channelService`'s
 * snapshot rather than chasing extra REST calls — the v3 connect
 * handler joined every channel room and seeded the channel list
 * before the first message can arrive, so the snapshot is always
 * populated for inbound `message.created` events.
 *
 * The adapter is intentionally permissive: missing pieces fall back
 * to sensible defaults so a malformed wire payload never breaks the
 * notification pipeline.
 */

import { channelService } from "../../../services/channel/channelService";
import type { UserProps } from "../../../types/admin";
import { ChannelKind, type Message } from "../../../types/channel";
import type { NewMessageProps, NewThreadMessageProps } from "../../../types/chat";

const KIND_TO_CHAT_TYPE: Record<ChannelKind, number> = {
    [ChannelKind.DM]: 1,
    [ChannelKind.GM]: 2,
    [ChannelKind.PM]: 3,
    [ChannelKind.MDM]: 4,
};

const EMPTY_USER: UserProps = {
    avatarImgPath: "",
    isSystemUser: false,
    teamId: "",
    teamName: "",
    tsJoined: "",
    tsLastSeen: "",
    userEmail: "",
    userId: "",
    userName: "",
};

function senderToLegacy(m: Message): UserProps {
    if (!m.sender) return EMPTY_USER;
    return {
        ...EMPTY_USER,
        avatarImgPath: m.sender.avatarImgPath || "",
        isSystemUser: !!m.sender.isSystemUser,
        userEmail: m.sender.userEmail,
        userId: m.sender.userId,
        userName: m.sender.userName,
    };
}

/** Resolve the DM "other side" so the notification icon + receiver
 *  fields are correct. Returns the empty user for non-DM channels
 *  (those don't need a partner). */
function resolveDmPartner(channelId: string, currentUserId: string | null): UserProps {
    if (!currentUserId) return EMPTY_USER;
    const snapshot = channelService.getSnapshot();
    const members = snapshot.membersByChannel.get(channelId);
    if (!members) return EMPTY_USER;
    for (const m of members) {
        if (!m.user) continue;
        if (m.user.userId !== currentUserId) {
            return {
                ...EMPTY_USER,
                avatarImgPath: m.user.avatarImgPath || "",
                isSystemUser: !!m.user.isSystemUser,
                userEmail: m.user.userEmail,
                userId: m.user.userId,
                userName: m.user.userName,
            };
        }
    }
    return EMPTY_USER;
}

function resolveChannelTitle(channelId: string): string {
    const ch = channelService.getSnapshot().channels.get(channelId);
    return ch?.title || "";
}

function mentionedIdsFromMessage(m: Message): string[] {
    if (!Array.isArray(m.mentions)) return [];
    return m.mentions.map((x) => x.mentionedUserId).filter((x): x is string => !!x);
}

/**
 * Build a legacy `NewMessageProps`-shaped object so `buildChatIntent`
 * can run unchanged. The `wsType` / `isThread` discriminators are set
 * to match what the legacy Flask broadcast used to carry.
 *
 * `myself` is the current user — needed for DM partner resolution and
 * the receiver field on DM payloads.
 */
export function v3MessageToLegacyChatPayload(m: Message, myself: UserProps): NewMessageProps {
    const chatType = KIND_TO_CHAT_TYPE[m.channelKind] ?? 0;
    const sender = senderToLegacy(m);
    const dmPartner = chatType === 1 ? resolveDmPartner(m.channelId, myself.userId) : EMPTY_USER;
    // For DM the `receiver` is the OTHER member from the sender's POV.
    // From the recipient's POV that's `myself`; either way we set it
    // to `myself` for incoming DMs so `buildChatIntent.isIncomingDm`
    // correctly identifies the inbound case.
    const receiver = chatType === 1 ? myself : EMPTY_USER;
    // Keys sorted natural-case-insensitive ascending per the project's
    // `sort-keys` lint rule.
    return {
        chatId: m.channelId as unknown as number,
        chatName: chatType === 1 ? dmPartner.userName : resolveChannelTitle(m.channelId),
        chatType,
        content: Array.isArray(m.body) ? m.body : [],
        contentText: m.bodyText ?? "",
        displayId: m.displayId ?? null,
        dmPartnerUser: dmPartner,
        isEdited: false,
        isReactionUpdated: false,
        isThread: !!m.isThreadReply,
        lastReadMessageId: 0,
        mentionedUserIds: mentionedIdsFromMessage(m),
        messageId: (m.seq ?? 0) as number,
        numReplies: m.replyCount ?? 0,
        reactions: [],
        receiver,
        sender,
        systemUserId: m.sender?.isSystemUser ? m.sender.userId : undefined,
        taskId: (m.taskId ?? null) as number | null,
        taskStatus: m.taskStatus ?? null,
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        wsType: "chat",
    };
}

/**
 * Same idea as `v3MessageToLegacyChatPayload` but produces a
 * `NewThreadMessageProps`-shaped object. Used when the inbound v3
 * `Message` is a thread reply (parentId is set + isThreadReply=true).
 *
 * `threadId` is the parent message's UUID — flowed through the legacy
 * `number` slot via the same migration cast as everywhere else.
 */
export function v3MessageToLegacyThreadPayload(
    m: Message,
    myself: UserProps
): NewThreadMessageProps {
    const chatType = KIND_TO_CHAT_TYPE[m.channelKind] ?? 0;
    const sender = senderToLegacy(m);
    const dmPartner = chatType === 1 ? resolveDmPartner(m.channelId, myself.userId) : EMPTY_USER;
    const receiver = chatType === 1 ? myself : EMPTY_USER;
    return {
        chatId: m.channelId as unknown as number,
        chatName: chatType === 1 ? dmPartner.userName : resolveChannelTitle(m.channelId),
        chatType,
        content: Array.isArray(m.body) ? m.body : [],
        contentText: m.bodyText ?? "",
        dmPartnerUser: dmPartner,
        isEdited: false,
        isReactionUpdated: false,
        isThread: true,
        mentionedUserIds: mentionedIdsFromMessage(m),
        messageId: (m.seq ?? 0) as number,
        reactions: [],
        receiver,
        sender,
        systemUserId: m.sender?.isSystemUser ? m.sender.userId : undefined,
        taskId: (m.taskId ?? null) as number | null,
        threadId: (m.parentId || m.threadRootId || "") as unknown as number,
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        wsType: "chat",
    } as NewThreadMessageProps;
}
