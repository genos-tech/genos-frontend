import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { fmt, getMessages } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps, NewMessageProps, NewThreadMessageProps } from "../../types/chat";
import { InboxItemProps } from "../../types/common";
import { buildAvatarSrc } from "../../utils/avatarSrc";
import { NotificationIntent } from "./types";

// ---------------------------------------------------------------------
// Avatar resolution
//
// Native browser `Notification({ icon })` needs a fully-qualified URL.
// All avatar fields on the wire (`avatarImgPath`, `profileImagePath`,
// `teamImgPath`) are media-server-relative paths — the in-app Avatar
// components compose the URL locally, so the same composition has to
// happen here too.
//
// Icon precedence by category (most-specific context wins, with
// sender's user avatar as the fallback for everything but DM where
// it IS the most specific):
//   * DM (chatType 1)     → sender's user avatar
//   * GM (chatType 2)     → GM's `profileImagePath`,         else sender
//   * PM (chatType 3)     → project's `profileImagePath`,    else sender
//   * MDM (chatType 4)    → sender's user avatar (no MDM-level image exists)
//   * Mention/task_comment activity scoped to a project
//                         → project's `profileImagePath`,    else sender
//   * Inbox (team-scoped) → current team's `teamImgPath`
// ---------------------------------------------------------------------

const lookupChatProfileImage = (
    useCM: ChatManagementState,
    chatType: number,
    chatId: number | string
): string | undefined => {
    const idNum = typeof chatId === "string" ? Number(chatId) : chatId;
    const chat = useCM.allChats.find((c) => c.chatType === chatType && c.chatId === idNum);
    return chat?.profileImagePath || undefined;
};

const lookupProjectImage = (
    useCM: ChatManagementState,
    projectId: number | undefined
): string | undefined => {
    if (projectId === undefined || projectId === null) return undefined;
    // Each project has exactly one PM chat; its `profileImagePath` IS the
    // project's avatar (the PM chat record and the project share one image).
    const pm = useCM.allChats.find((c) => c.chatType === 3 && c.project?.projectId === projectId);
    return pm?.profileImagePath || undefined;
};

const resolveChatIcon = (
    chatType: number,
    chatId: number,
    senderId: string,
    projectId: number | undefined,
    useCM: ChatManagementState,
    useTEM: TeamManagementState
): string | undefined => {
    const senderPath = useTEM.teamMemberProfiles[senderId]?.avatarImgPath || undefined;

    let contextPath: string | undefined;
    if (chatType === 2) {
        contextPath = lookupChatProfileImage(useCM, 2, chatId);
    } else if (chatType === 3) {
        // PM chat's own image (which is the project's image) takes priority;
        // falling back to `lookupProjectImage(projectId)` would resolve to
        // the same record anyway, but the chatId path is one fewer lookup.
        contextPath = lookupChatProfileImage(useCM, 3, chatId);
    }
    // chatType 1 (DM) and 4 (MDM) skip context lookup — sender's avatar
    // IS the most-specific source for those.

    return buildAvatarSrc(contextPath || senderPath);
};

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
    const labels = getMessages().services.notifications.routerChatType;
    switch (chatType) {
        case 1:
            return labels.direct;
        case 2:
            return chatName ? fmt(labels.groupNamed, { name: chatName }) : labels.group;
        case 3:
            return chatName ? fmt(labels.projectNamed, { name: chatName }) : labels.project;
        case 4:
            return chatName ? `${chatName}` : labels.groupDm;
        default:
            return labels.unknown;
    }
};

const buildChatIntent = (
    msg: NewMessageProps,
    myself: UserProps,
    useTEM: TeamManagementState,
    useCM: ChatManagementState
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

    const routerMessages = getMessages().services.notifications.router;
    const senderName = msg.sender.userName || routerMessages.someone;
    const chatLabel = labelForChatType(msg.chatType, msg.chatName);
    const title =
        msg.chatType === 1
            ? senderName
            : msg.chatType === 3
              ? chatLabel
              : fmt(routerMessages.chatTitleWithLabel, { senderName, chatLabel });

    return {
        id: `chat:${msg.chatType}:${msg.chatId}:${msg.messageId}`,
        category: "chats",
        title,
        body: truncate(msg.contentText || ""),
        icon: resolveChatIcon(
            msg.chatType,
            msg.chatId,
            msg.sender.userId,
            msg.project?.projectId,
            useCM,
            useTEM
        ),
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
    useTEM: TeamManagementState,
    useCM: ChatManagementState
): NotificationIntent | null => {
    if (msg.isEdited || msg.isDeleted || msg.isReactionUpdated) return null;
    if (!msg.sender || msg.sender.userId === myself.userId) return null;

    // Mirrors handleThreadMessage's `isIncomingForMe`.
    const fromMe = msg.sender.userId === myself.userId;
    const toMe = msg.chatType === 1 && msg.receiver?.userId === myself.userId;
    const isRoomChat = msg.chatType === 2 || msg.chatType === 3 || msg.chatType === 4;
    const isIncomingForMe = (!fromMe && toMe) || (!fromMe && isRoomChat);
    if (!isIncomingForMe) return null;

    const routerMessages = getMessages().services.notifications.router;
    const senderName = msg.sender.userName || routerMessages.someone;
    const parentLabel = labelForChatType(msg.chatType, msg.chatName);
    const title = fmt(routerMessages.threadReplyTitle, { senderName, parentLabel });

    return {
        id: `thread:${msg.chatType}:${msg.chatId}:${msg.threadId}:${msg.messageId}`,
        category: "thread_replies",
        title,
        body: truncate(msg.contentText || ""),
        icon: resolveChatIcon(
            msg.chatType,
            msg.chatId,
            msg.sender.userId,
            msg.project?.projectId,
            useCM,
            useTEM
        ),
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
    useTEM: TeamManagementState,
    useCM: ChatManagementState
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

    const routerMessages = getMessages().services.notifications.router;
    const senderName = (activity as any).senderName || routerMessages.someone;
    const subjectLabel = activity.projectName
        ? fmt(routerMessages.activityProjectLabel, { projectName: activity.projectName })
        : labelForChatType(activity.chatType, activity.chatName);
    const title =
        category === "mentions"
            ? fmt(routerMessages.mentionTitle, { senderName, subjectLabel })
            : fmt(routerMessages.taskCommentTitle, { senderName });

    // Project-scoped activity (mentions in a PM bubble, task comments) gets
    // the project avatar so the user can see at a glance which project the
    // notification is for. Mentions in a DM still fall back to the sender.
    const projectImage = lookupProjectImage(useCM, activity.projectId);
    const senderImage = useTEM.teamMemberProfiles[activity.senderId]?.avatarImgPath;
    const icon = buildAvatarSrc(projectImage || senderImage);

    return {
        id: `activity:${category}:${activity.activityId}`,
        category,
        title,
        body: truncate(activity.firstLineContent || ""),
        icon,
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
    alreadyExist: boolean,
    useTEM: TeamManagementState
): NotificationIntent | null => {
    if (alreadyExist) return null;

    const routerMessages = getMessages().services.notifications.router;
    const body = truncate(extractInboxText(item.itemBody) || routerMessages.inboxFallback);
    const titleByType: Record<number, string> = {
        0: routerMessages.inboxTitleNewActivity,
        1: routerMessages.inboxTitleJoinTeam,
        2: routerMessages.inboxTitleJoinProject,
        3: routerMessages.inboxTitleJoinGroup,
    };
    const title = titleByType[item.itemType] || routerMessages.inboxFallback;

    return {
        id: `inbox:${item.itemId}`,
        category: "inbox",
        title,
        body,
        // Inbox items are team-scoped (join-team / join-project / join-gm
        // requests routed through the team). The most representative image
        // available without joining extra tables is the team's avatar; we
        // surface that so the user can see which workspace pinged them
        // when multiple teams are configured.
        icon: buildAvatarSrc(useTEM.currentTeam?.teamImgPath),
        // `source` is left undefined — inbox items don't have a per-chat
        // mute target and bypass per-chat mute on purpose.
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
    useTEM: TeamManagementState,
    useCM: ChatManagementState
): NotificationIntent | null => {
    if (!message || !message.wsType) return null;
    if (!myself || !myself.userId) return null;

    if (message.wsType === "chat") {
        if (message.isThread === true) {
            return buildThreadIntent(message as NewThreadMessageProps, myself, useTEM, useCM);
        }
        return buildChatIntent(message as NewMessageProps, myself, useTEM, useCM);
    }

    if (message.wsType === "activity") {
        return buildActivityIntent(message as ActivityMessageProps, myself, useTEM, useCM);
    }

    if (message.wsType === "inbox") {
        return buildInboxIntent(
            message.data as InboxItemProps,
            message.alreadyExist === true,
            useTEM
        );
    }

    return null;
};
