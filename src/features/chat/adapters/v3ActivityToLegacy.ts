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

import type { UserProps } from "../../../types/admin";
import type { ActivityMessageProps } from "../../../types/chat";

interface V3ActivityWire {
    id: string;
    activityType: number;
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

export function v3ActivityToLegacy(a: V3ActivityWire, myself: UserProps): ActivityMessageProps {
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
        chatName: "",
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
        mentionedUserIds: [],
        mentionedViaGroups: undefined,
        isRead: a.isRead,
        systemUserId: msg.sender?.isSystemUser ? msg.sender.userId : undefined,
    };
}
