/**
 * Adapter: v3 `Activity` wire shape → legacy `ActivityMessageProps`
 * that the existing FE activity sidebar / IDB store consumes.
 *
 * Mirrors the migration pattern used in `v3ToLegacy.ts`: keep the
 * legacy shape, push the v3 UUID through legacy `number` slots via
 * `as unknown as number`, populate the rest from what the v3 backend
 * gives us. Most legacy fields downstream consumers compare as strings
 * (chatId equality checks, route segments) so the cast is structurally
 * safe.
 *
 * Anything the v3 payload doesn't carry directly (DM partner identity,
 * project name, etc.) is left as a sensible default — the legacy
 * sidebar tolerates empty strings.
 */

import { channelService } from "../../../services/channel/channelService";
import type { UserProps } from "../../../types/admin";
import type { ActivityMessageProps } from "../../../types/chat";

interface V3ActivityWire {
    id: string;
    activityType: number;
    // Non-null for channel-less "surface" mention activities (task body
    // + the three note types) — carries the legacy chat_type namespace
    // (5=task body, 6=personal note, 7=task note, 8=chat note). When set,
    // `channelId`/`channelKind`/`message` are null and the routing ids
    // live in `meta`.
    surfaceType?: number | null;
    recipientUserId: string;
    channelId: string;
    channelKind: number;
    messageId: string;
    actor: {
        userId: string;
        userName: string;
        userEmail: string;
        avatarImgPath?: string;
        isSystemUser?: boolean;
    } | null;
    message: {
        id: string;
        channelId: string;
        channelKind: number;
        sender: {
            userId: string;
            userName: string;
            userEmail: string;
            avatarImgPath?: string;
            isSystemUser?: boolean;
        } | null;
        seq?: number;
        bodyText?: string;
        parentId?: string | null;
        isThreadReply: boolean;
        taskId?: number | null;
        displayId?: string | null;
        // PM messages carry task fields in `metadata`; task-comment
        // mirrors set `{ taskCommentId }` here — the notification router's
        // task-comment discriminator.
        metadata?: Record<string, unknown> | null;
    };
    meta: Record<string, unknown>;
    isRead: boolean;
    tsCreated: string;
}

const EMPTY_USER: UserProps = {
    userId: "",
    userName: "",
    userEmail: "",
    teamId: "",
    teamName: "",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    isSystemUser: false,
};

/**
 * Resolve a display-friendly `chatName` for the activity row.
 *
 * Reads from the `channelService` snapshot so the value matches the
 * sidebar's chat-list label. Falls back to the actor's name for DMs
 * (the DM has no title — the partner's name IS the label) and to a
 * single `"?"` placeholder so downstream consumers that take
 * `chatName[0]` (e.g. `ActivityAvatar`'s initial-letter fallback) don't
 * crash on the empty string.
 */
function resolveChatName(a: V3ActivityWire): string {
    const ch = channelService.getSnapshot().channels.get(a.channelId);
    if (ch && ch.title) return ch.title;
    if (a.channelKind === 1 && a.actor?.userName) return a.actor.userName;
    return "?";
}

export function v3ActivityToLegacy(a: V3ActivityWire, myself: UserProps): ActivityMessageProps {
    // Channel-less "surface" mention (task body / note). There's no
    // backing Message/Channel, so render + route from `meta`. `chatType`
    // is the surface namespace (5=task body, 6/7/8=notes) which
    // `chatListItemForActivity` already knows how to route:
    //   - task body (5) opens the task preview via projectId + taskId
    //   - notes (6/7/8) open the note via chatId (== the note id)
    if (a.surfaceType != null) {
        const meta = (a.meta ?? {}) as Record<string, unknown>;
        const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
        const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
        const taskId = num(meta.taskId) ?? 0;
        const projectId = num(meta.projectId);
        const noteId = num(meta.noteId) ?? 0;
        // Chat-note (surface 8) mentions carry the PARENT chat's routing in
        // meta so a clicked notification can deep-link to the note. Other
        // surfaces leave these unset. `chatId` is opaque (legacy number or
        // v3 UUID string) so it's read as-is, not coerced to a number.
        const noteChatType = num(meta.chatType);
        const noteChatId =
            typeof meta.chatId === "string" || typeof meta.chatId === "number"
                ? meta.chatId
                : undefined;
        const noteThreadId = num(meta.threadId);
        // Notes route by `chatId === noteId`; task body routes by
        // projectId + taskId (its chatId slot mirrors the legacy
        // project-id packing).
        const chatId = a.surfaceType === 5 ? (projectId ?? 0) : noteId;
        return {
            activityId: a.id,
            activityType: a.activityType,
            chatType: a.surfaceType,
            chatId: chatId as unknown as number,
            chatName: str(meta.projectName) ?? str(meta.noteTitle) ?? "",
            dmPartnerUserId: "",
            dmPartnerUserName: "",
            dmPartnerUserEmail: "",
            isThread: false,
            threadId: 0 as unknown as number,
            messageId: 0,
            messageUniqueKey: a.id,
            threadMessageUniqueKey: "",
            taskId: taskId as number,
            displayId: str(meta.displayId) ?? null,
            projectId,
            projectName: str(meta.projectName),
            firstLineContent: str(meta.firstLineContent) ?? "",
            latestReaction: { emoji: "", sender: EMPTY_USER, tsSent: a.tsCreated },
            senderId: a.actor?.userId ?? "",
            receiver: myself,
            reactions: [],
            tsSent: a.tsCreated,
            // Seeds the "mentions" notification category (gated on
            // `mentionedUserIds.includes(myself.userId)`), same as the
            // channel-backed mention path below.
            mentionedUserIds: [a.recipientUserId] as unknown as [],
            mentionedViaGroups: undefined,
            isRead: a.isRead,
            ...(a.actor?.userName
                ? ({ senderName: a.actor.userName } as Partial<ActivityMessageProps>)
                : {}),
            systemUserId: undefined,
            // Parent-chat routing for chat-note (surface 8) deep-linking.
            noteChatType,
            noteChatId,
            noteThreadId,
        } as ActivityMessageProps;
    }

    const msg = a.message;
    const isThread = !!msg.isThreadReply;
    // `latestReaction` is only populated for reaction activities. Other
    // types use the same shape with empty strings — the legacy renderer
    // checks `activityType` before using the field.
    const latestReaction =
        a.activityType === 2 && a.actor
            ? {
                  emoji: String((a.meta && a.meta.emoji) || ""),
                  sender: {
                      ...EMPTY_USER,
                      userId: a.actor.userId,
                      userName: a.actor.userName,
                      userEmail: a.actor.userEmail,
                      avatarImgPath: a.actor.avatarImgPath || "",
                      isSystemUser: !!a.actor.isSystemUser,
                  },
                  tsSent: a.tsCreated,
              }
            : { emoji: "", sender: EMPTY_USER, tsSent: a.tsCreated };
    return {
        activityId: a.id,
        activityType: a.activityType,
        chatType: a.channelKind,
        // `chatId`, `messageId`, `threadId` are typed `number` in the
        // legacy shape but downstream callers compare them as strings —
        // see the `v3ToLegacy.ts` migration notes. UUIDs go through the
        // same `as unknown as number` cast.
        chatId: a.channelId as unknown as number,
        chatName: resolveChatName(a),
        dmPartnerUserId: "",
        dmPartnerUserName: "",
        dmPartnerUserEmail: "",
        isThread,
        threadId: (isThread ? msg.parentId || "" : "") as unknown as number,
        messageId: (msg.seq ?? 0) as number,
        messageUniqueKey: msg.id,
        threadMessageUniqueKey: isThread ? msg.id : "",
        taskId: (msg.taskId ?? 0) as number,
        displayId: msg.displayId ?? null,
        projectId: undefined,
        projectName: undefined,
        firstLineContent: msg.bodyText ?? "",
        latestReaction,
        senderId: msg.sender?.userId ?? "",
        receiver: myself,
        reactions: [],
        tsSent: a.tsCreated,
        // For mention activities, the recipient IS the mentioned user
        // (one Activity row per recipient is fanned out by the v3
        // producer). The legacy `buildActivityIntent` notification path
        // gates on `mentionedUserIds.includes(myself.userId)`, so seed
        // the array with the recipient id; without this seed the
        // "mentions" web-notification category never fires for v3-side
        // mentions.
        mentionedUserIds: a.activityType === 3 ? ([a.recipientUserId] as unknown as []) : [],
        mentionedViaGroups: undefined,
        isRead: a.isRead,
        // Display name for the actor — used as `senderName` in the
        // legacy notification builder. The activity producer always
        // serialises `actor` for non-self activities so this is
        // populated; falls back to empty so the legacy "someone"
        // string kicks in if the wire payload is missing it.
        ...(a.actor?.userName
            ? ({ senderName: a.actor.userName } as Partial<ActivityMessageProps>)
            : {}),
        systemUserId: msg.sender?.isSystemUser ? msg.sender.userId : undefined,
        // Task comments are mirrored as PM thread replies but carry a
        // `taskCommentId` in metadata — the router uses this to treat them
        // as real-user task comments, not bot lifecycle bubbles.
        isTaskComment: !!(msg.metadata && (msg.metadata as Record<string, unknown>).taskCommentId),
    } as ActivityMessageProps;
}
