import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps, NewMessageProps, NewThreadMessageProps } from "../../types/chat";
import { InboxItemProps } from "../../types/common";
import { NotificationIntent } from "./types";

const truncate = (s: string, max = 140): string => {
    const flat = (s || "").replace(/\s+/g, " ").trim();
    return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};

// Best-effort plain-text from BlockNote PartialBlock[] content used in
// inbox items. Walks one level of inline content.
const extractInboxText = (body: any): string => {
    if (!Array.isArray(body)) return "";
    const lines: string[] = [];
    for (const block of body) {
        if (!block || typeof block !== "object") continue;
        const content = (block as any).content;
        if (typeof content === "string") {
            lines.push(content);
        } else if (Array.isArray(content)) {
            for (const span of content) {
                if (span && typeof span === "object" && typeof span.text === "string") {
                    lines.push(span.text);
                }
            }
        }
    }
    return lines.join(" ").trim();
};

const labelForChatType = (chatType: number, chatName?: string): string => {
    switch (chatType) {
        case 1:
            return "Direct message";
        case 2:
            return chatName ? `#${chatName}` : "Group";
        case 3:
            return chatName ? `Project • ${chatName}` : "Project chat";
        case 4:
            return chatName ? `${chatName}` : "Group DM";
        default:
            return "Chat";
    }
};

const buildChatIntent = (
    msg: NewMessageProps,
    myself: UserProps,
    useTEM: TeamManagementState
): NotificationIntent | null => {
    if (msg.isEdited || msg.isDeleted || msg.isReactionUpdated) return null;
    if (!msg.sender || msg.sender.userId === myself.userId) return null;

    // Replicates the "incoming for me" logic from message-handlers:
    //   - DM: receiver is me and sender is not me
    //   - GM/PM/MDM: any non-self message in a room I'm in
    const isIncomingDm =
        msg.chatType === 1 &&
        msg.receiver?.userId === myself.userId &&
        msg.sender.userId !== myself.userId;
    const isRoomMessage = msg.chatType === 2 || msg.chatType === 3 || msg.chatType === 4;
    if (!isIncomingDm && !isRoomMessage) return null;

    const senderName = msg.sender.userName || "Someone";
    const chatLabel = labelForChatType(msg.chatType, msg.chatName);

    console.log("send chat notification", {
        id: `chat:${msg.chatType}:${msg.chatId}:${msg.messageId}`,
        category: "chats",
        title:
            msg.chatType === 1
                ? senderName
                : msg.chatType === 3
                  ? chatLabel
                  : `${senderName} • ${chatLabel}`,
        body: truncate(msg.contentText || ""),
        icon: useTEM.teamMemberProfiles[msg.sender.userId]?.avatarImgPath || undefined,
        senderId: msg.sender.userId,
    });

    return {
        id: `chat:${msg.chatType}:${msg.chatId}:${msg.messageId}`,
        category: "chats",
        title:
            msg.chatType === 1
                ? senderName
                : msg.chatType === 3
                  ? chatLabel
                  : `${senderName} • ${chatLabel}`,
        body: truncate(msg.contentText || ""),
        icon: useTEM.teamMemberProfiles[msg.sender.userId]?.avatarImgPath || undefined,
        senderId: msg.sender.userId,
        source: {
            chatType: msg.chatType,
            chatId: String(msg.chatId),
            // PM (chatType 3) messages carry the project so click-to-open
            // can route via the project chat URL.
            projectId: msg.project?.projectId,
            taskId: msg.taskId ?? undefined,
        },
    };
};

const buildThreadIntent = (
    msg: NewThreadMessageProps,
    myself: UserProps,
    useTEM: TeamManagementState
): NotificationIntent | null => {
    if (msg.isEdited || msg.isDeleted || msg.isReactionUpdated) return null;
    if (!msg.sender || msg.sender.userId === myself.userId) return null;

    // Mirrors handleThreadMessage's `isIncomingForMe`.
    const fromMe = msg.sender.userId === myself.userId;
    const toMe = msg.chatType === 1 && msg.receiver?.userId === myself.userId;
    const isRoomChat = msg.chatType === 2 || msg.chatType === 3 || msg.chatType === 4;
    const isIncomingForMe = (!fromMe && toMe) || (!fromMe && isRoomChat);
    if (!isIncomingForMe) return null;

    const senderName = msg.sender.userName || "Someone";
    const parentLabel = labelForChatType(msg.chatType, msg.chatName);

    console.log("send thread notification", {
        id: `thread:${msg.chatType}:${msg.chatId}:${msg.threadId}:${msg.messageId}`,
        category: "thread_replies",
        title: `${senderName} replied in ${parentLabel}`,
        body: truncate(msg.contentText || ""),
        icon: useTEM.teamMemberProfiles[msg.sender.userId].avatarImgPath || undefined,
        senderId: msg.sender.userId,
    });

    return {
        id: `thread:${msg.chatType}:${msg.chatId}:${msg.threadId}:${msg.messageId}`,
        category: "thread_replies",
        title: `${senderName} replied in ${parentLabel}`,
        body: truncate(msg.contentText || ""),
        icon: useTEM.teamMemberProfiles[msg.sender.userId].avatarImgPath || undefined,
        senderId: msg.sender.userId,
        source: {
            chatType: msg.chatType,
            chatId: String(msg.chatId),
            threadId: msg.threadId,
            taskId: msg.taskId ?? undefined,
            projectId: msg.project?.projectId,
        },
    };
};

const buildActivityIntent = (
    activity: ActivityMessageProps,
    myself: UserProps,
    useTEM: TeamManagementState
): NotificationIntent | null => {
    // Reactions are intentionally out of scope for the "balanced" coverage
    // option the user picked.
    if (activity.activityType === 2) return null;
    if (!activity.senderId || activity.senderId === myself.userId) return null;

    const mentionsMe = Array.isArray(activity.mentionedUserIds)
        ? (activity.mentionedUserIds as string[]).includes(myself.userId)
        : false;

    let category: NotificationIntent["category"] | null = null;
    if (mentionsMe) {
        category = "mentions";
    } else if (activity.chatType === 4) {
        // chatType 4 in the activity feed denotes task-comment activity.
        category = "task_comments";
    }
    if (!category) return null;

    const senderName = (activity as any).senderName || "Someone";
    const subjectLabel = activity.projectName
        ? `Project • ${activity.projectName}`
        : labelForChatType(activity.chatType, activity.chatName);

    console.log("send activity notification", {
        id: `activity:${category}:${activity.activityId}`,
        category,
        title:
            category === "mentions"
                ? `${senderName} mentioned you in ${subjectLabel}`
                : `${senderName} commented on a task`,
        body: truncate(activity.firstLineContent || ""),
    });

    return {
        id: `activity:${category}:${activity.activityId}`,
        category,
        title:
            category === "mentions"
                ? `${senderName} mentioned you in ${subjectLabel}`
                : `${senderName} commented on a task`,
        body: truncate(activity.firstLineContent || ""),
        icon: useTEM.teamMemberProfiles[(activity as any).senderId].avatarImgPath || undefined,
        senderId: activity.senderId,
        source: {
            chatType: activity.chatType,
            chatId: activity.chatId !== undefined ? String(activity.chatId) : undefined,
            threadId: activity.threadId || undefined,
            taskId: activity.taskId || undefined,
            projectId: activity.projectId || undefined,
        },
    };
};

const buildInboxIntent = (
    item: InboxItemProps,
    alreadyExist: boolean
): NotificationIntent | null => {
    if (alreadyExist) return null;

    const body = truncate(extractInboxText(item.itemBody) || "New inbox item");
    const titleByType: Record<number, string> = {
        0: "New activity",
        1: "Join team request",
        2: "Join project request",
        3: "Join group request",
    };
    const title = titleByType[item.itemType] || "New inbox item";

    return {
        id: `inbox:${item.itemId}`,
        category: "inbox",
        title,
        body,
        // Inbox items are global per-user, not tied to a chatType/chatId, so
        // `source` is left undefined — they bypass per-chat mute on purpose.
    };
};

/**
 * Translate a raw websocket payload into a `NotificationIntent`, or `null`
 * for everything we do not surface (presence, edits, deletes, reactions,
 * self-originated traffic, refresh pings, ...).
 *
 * The filtering deliberately mirrors what the existing handlers in
 * `message-handlers.ts` and `activity-handlers.ts` already consider
 * "actionable for me" so the notification stream tracks the in-app
 * activity stream.
 */
export const buildIntentFromMessage = (
    message: any,
    myself: UserProps,
    useTEM: TeamManagementState
): NotificationIntent | null => {
    if (!message || !message.wsType) return null;
    if (!myself || !myself.userId) return null;

    console.log("message", message);

    if (message.wsType === "chat") {
        if (message.isThread === true) {
            return buildThreadIntent(message as NewThreadMessageProps, myself, useTEM);
        }
        return buildChatIntent(message as NewMessageProps, myself, useTEM);
    }

    if (message.wsType === "activity") {
        return buildActivityIntent(message as ActivityMessageProps, myself, useTEM);
    }

    if (message.wsType === "inbox") {
        return buildInboxIntent(message.data as InboxItemProps, message.alreadyExist === true);
    }

    return null;
};
