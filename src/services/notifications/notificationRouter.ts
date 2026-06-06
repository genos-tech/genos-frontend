import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { fmt, getMessages } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps, NewMessageProps, NewThreadMessageProps } from "../../types/chat";
import { InboxItemProps } from "../../types/common";
import { buildAvatarSrc } from "../../utils/avatarSrc";
import { CATEGORY_BY_KEY, NotificationCategory } from "./categories";
import { NotificationIntent } from "./types";

/**
 * A task comment is either a v3 PM-thread mirror (the `isTaskComment` flag,
 * set from `message.metadata.taskCommentId`) OR a legacy chat_type=4 row that
 * carries a `taskId`. A chat_type=4 row WITHOUT a taskId is a multi-user DM
 * (MDM), NOT a task comment — the two share chat_type=4 and must be kept
 * apart, otherwise an MDM message gets mislabeled "commented on a task".
 * This is the single discriminator reused by the chips + avatar code.
 */
const isTaskCommentActivity = (activity: ActivityMessageProps): boolean =>
    activity.isTaskComment === true || (activity.chatType === 4 && !!activity.taskId);

/**
 * Map a mention activity to its fine sub-category from the surface encoded
 * in `chatType` (the v3→legacy adapter packs surface_type here):
 *   task comment, 5 = task body, 6/7/8 = my/task/chat note,
 *   else a thread reply -> mention_thread, else (1/2/3/MDM) -> mention_chat.
 * Task comment is checked BEFORE `isThread`/chat type because task comments
 * are stored as thread replies and must stay in their own bucket; a plain
 * MDM (chat_type=4, no taskId) correctly falls through to mention_chat/thread.
 */
const classifyMention = (activity: ActivityMessageProps): NotificationCategory => {
    if (isTaskCommentActivity(activity)) return "mention_task_comment";
    switch (activity.chatType) {
        case 5:
            return "mention_task_body";
        case 6:
            return "mention_note_my";
        case 7:
            return "mention_note_task";
        case 8:
            return "mention_note_chat";
    }
    if (activity.isThread === true) return "mention_thread";
    return "mention_chat";
};

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
    // `AllChatProps.chatId` is `string` post-v3 flip. Notification
    // intents arrive with either shape (legacy events still emit
    // numeric `chatId` for DM/GM/MDM/PM; the v3 socket will emit
    // UUID strings). Normalize both sides to string for the lookup.
    const idStr = String(chatId);
    const chat = useCM.allChats.find((c) => c.chatType === chatType && c.chatId === idStr);
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
// inbox items. Walks one level of inline content. `unknown` is the
// honest type — the WS payload's `body` can be a BlockNote document or
// some legacy shape; the type guards below narrow safely.
const extractInboxText = (body: unknown): string => {
    if (!Array.isArray(body)) return "";
    const lines: string[] = [];
    for (const block of body) {
        if (!block || typeof block !== "object") continue;
        const content = (block as { content?: unknown }).content;
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

    // System-user (project bot) speaks for automated PM messages:
    // task-created cards, status-change cards, and similar. The matching
    // activity push still fires the `mentions` intent for anyone tagged
    // in the bubble's mention nodes, so skipping the bot's chat intent
    // removes a near-duplicate notification without losing the personal
    // signal. Catches the "I just created a task — why am I getting
    // pinged about my own action?" case for the creator.
    if (msg.systemUserId && msg.sender.userId === msg.systemUserId) return null;

    // When the same broadcast also carries the user as a mentioned
    // recipient, the parallel `wsType:"activity"` push will deliver the
    // more-specific `mentions` intent — keep that one and suppress this
    // generic `chats` intent. Empty/missing list is the no-mentions
    // case and falls through normally.
    if (Array.isArray(msg.mentionedUserIds) && msg.mentionedUserIds.includes(myself.userId)) {
        return null;
    }

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

    // Keys sorted alphabetically per `sort-keys`.
    return {
        body: truncate(msg.contentText || ""),
        category: "chats",
        icon: resolveChatIcon(
            msg.chatType,
            msg.chatId,
            msg.sender.userId,
            msg.project?.projectId,
            useCM,
            useTEM
        ),
        id: `chat:${msg.chatType}:${msg.chatId}:${msg.messageId}`,
        senderId: msg.sender.userId,
        source: {
            chatId: String(msg.chatId),
            chatType: msg.chatType,
            // PM (chatType 3) messages carry the project so click-to-open
            // can route via the project chat URL.
            projectId: msg.project?.projectId,
            taskId: msg.taskId ?? undefined,
        },
        title,
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

    // Same bot-suppression as buildChatIntent: PM thread bubbles for
    // task lifecycle events (created / moved to <status>) are posted by
    // the project's system user. Skip them here — the activity push for
    // anyone actually mentioned still fires.
    if (msg.systemUserId && msg.sender.userId === msg.systemUserId) return null;

    // Defer to the parallel mentions activity intent for users who are
    // tagged in this thread reply (see buildChatIntent for the same
    // pattern and rationale).
    if (Array.isArray(msg.mentionedUserIds) && msg.mentionedUserIds.includes(myself.userId)) {
        return null;
    }

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

    // Keys sorted per `sort-keys`.
    return {
        body: truncate(msg.contentText || ""),
        category: "thread_replies",
        icon: resolveChatIcon(
            msg.chatType,
            msg.chatId,
            msg.sender.userId,
            msg.project?.projectId,
            useCM,
            useTEM
        ),
        id: `thread:${msg.chatType}:${msg.chatId}:${msg.threadId}:${msg.messageId}`,
        senderId: msg.sender.userId,
        source: {
            chatId: String(msg.chatId),
            chatType: msg.chatType,
            projectId: msg.project?.projectId,
            taskId: msg.taskId ?? undefined,
            threadId: msg.threadId,
        },
        title,
    };
};

export const buildActivityIntent = (
    activity: ActivityMessageProps,
    myself: UserProps,
    useTEM: TeamManagementState,
    useCM: ChatManagementState
): NotificationIntent | null => {
    // Reactions are intentionally out of scope for the "balanced" coverage
    // option the user picked.
    if (activity.activityType === 2) return null;
    if (!activity.senderId || activity.senderId === myself.userId) return null;

    // Task comments are mirrored as PM thread replies (chatType 3 +
    // isThread) but are authored by a REAL user, not the project bot —
    // the v3 mirror tags them with `message.metadata.taskCommentId`,
    // surfaced here as `isTaskComment`. They must NOT be treated as bot
    // lifecycle bubbles (or they'd be suppressed below and never notify).
    // Use the shared discriminator so a legacy chat_type=4+taskId comment is
    // covered too, while a plain MDM (chat_type=4, no taskId) is NOT.
    const isTaskComment = isTaskCommentActivity(activity);

    // PM activities are unconditionally sent as the project's system
    // user — `message_handlers.py` overrides `sender_user_id` to
    // `system_user_id` for every chat_type=3 broadcast. So `chatType === 3`
    // identifies the bot path; the `systemUserId === senderId` check is a
    // defensive extra. We exclude `isTaskComment` so genuine task comments
    // (real sender) keep their real-sender title/icon and are not eaten by
    // the thread-suppression rule.
    const senderIsBot =
        (!!activity.systemUserId && activity.senderId === activity.systemUserId) ||
        (activity.chatType === 3 && !isTaskComment);

    // Suppress PM thread bubbles posted by the bot — they're always
    // lifecycle bookkeeping ("New task created by @you", "@you moved
    // this task to In Progress") and the user being mentioned IS the
    // user who just took the action, so the notification is
    // self-attribution. Task comments are exempt (senderIsBot is false
    // for them). NOTE: a real human @mention in a NON-task PM thread is
    // also still suppressed here — a known, accepted limitation.
    if (senderIsBot && activity.isThread === true) {
        return null;
    }

    const mentionsMe = Array.isArray(activity.mentionedUserIds)
        ? (activity.mentionedUserIds as string[]).includes(myself.userId)
        : false;

    let category: NotificationCategory | null = null;
    if (mentionsMe) {
        // classifyMention already routes a task comment (v3 flag OR legacy
        // chat_type=4+taskId) to mention_task_comment, and a plain MDM to
        // mention_chat / mention_thread.
        category = classifyMention(activity);
    } else if (isTaskComment) {
        // A plain (non-mention) task comment — v3 mirror or legacy
        // chat_type=4+taskId. A plain MDM message (chat_type=4, no taskId)
        // is intentionally NOT routed here (it produces no activity-feed
        // notification; its in-app toast comes from the chat-message path).
        category = "task_comments";
    }
    if (!category) return null;

    const routerMessages = getMessages().services.notifications.router;
    // `senderName` isn't declared on `ActivityMessageProps` today but
    // the wire payload carries it for the display path. Narrow cast.
    const senderName = (activity as { senderName?: string }).senderName || routerMessages.someone;
    const subjectLabel = activity.projectName
        ? fmt(routerMessages.activityProjectLabel, { projectName: activity.projectName })
        : labelForChatType(activity.chatType, activity.chatName);
    // Use the bot-form title when the sender is the project's system
    // user — `senderIsBot` is already computed at the top of this
    // function and reused here so the redundant-prefix fix kicks in
    // whether or not the backend payload carries `systemUserId`.
    // All `mention_*` keys live in the "mentions" group and share the
    // mention/bot title; plain `task_comments` uses the comment title.
    const isMention = CATEGORY_BY_KEY[category]?.group === "mentions";
    const title = isMention
        ? senderIsBot
            ? fmt(routerMessages.mentionTitleByBot, { subjectLabel })
            : fmt(routerMessages.mentionTitle, { senderName, subjectLabel })
        : fmt(routerMessages.taskCommentTitle, { senderName });

    // Project-scoped activity (mentions in a PM bubble, task comments) gets
    // the project avatar so the user can see at a glance which project the
    // notification is for. Mentions in a DM still fall back to the sender.
    //
    // PM activities (chatType=3) are special: `message_handlers.py`'s
    // live activity payload doesn't carry `projectId`, so
    // `lookupProjectImage` returns undefined and the icon would fall
    // through to the system user's avatar (unset for the bot — toast
    // ends up showing a letter-fallback). The PM chat row stores the
    // project image as its `profileImagePath`, and the activity's
    // `chatId` IS that PM chat's id, so an `allChats` lookup keyed by
    // chatId recovers the project avatar without depending on the
    // missing field.
    const projectImage =
        activity.chatType === 3
            ? lookupChatProfileImage(useCM, 3, activity.chatId)
            : lookupProjectImage(useCM, activity.projectId);
    const senderImage = useTEM.teamMemberProfiles[activity.senderId]?.avatarImgPath;
    const icon = buildAvatarSrc(projectImage || senderImage);

    const isNoteSurface =
        activity.chatType === 6 || activity.chatType === 7 || activity.chatType === 8;
    // Chat-note (surface 8) mentions carry their PARENT chat's routing
    // (chatType/chatId/threadId) so the click handler can deep-link to the
    // note. Use it for chatType/chatId/threadId (keeping noteId + surfaceType
    // for note identity). Other surfaces keep the surface code in chatType.
    const hasParentChat =
        activity.chatType === 8 &&
        activity.noteChatType !== undefined &&
        activity.noteChatId !== undefined;

    // Keys sorted per `sort-keys`.
    return {
        body: truncate(activity.firstLineContent || ""),
        category,
        icon,
        id: `activity:${category}:${activity.activityId}`,
        senderId: activity.senderId,
        source: {
            chatId: hasParentChat
                ? String(activity.noteChatId)
                : activity.chatId !== undefined
                  ? String(activity.chatId)
                  : undefined,
            chatType: hasParentChat ? activity.noteChatType : activity.chatType,
            // For note mentions (surface 6/7/8) the adapter packs the note
            // id into `chatId`; surface it explicitly so per-object note
            // muting never has to read the overloaded `chatId`.
            noteId: isNoteSurface ? activity.chatId || undefined : undefined,
            projectId: activity.projectId || undefined,
            surfaceType: activity.chatType,
            taskId: activity.taskId || undefined,
            threadId: hasParentChat
                ? (activity.noteThreadId ?? undefined)
                : activity.threadId || undefined,
        },
        title,
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

    // Keys sorted per `sort-keys`. Inline note on `icon`: inbox items
    // are team-scoped (join-team / join-project / join-gm requests
    // routed through the team). The most representative image available
    // without joining extra tables is the team's avatar; we surface
    // that so the user can see which workspace pinged them when
    // multiple teams are configured.
    return {
        body,
        category: "inbox",
        icon: buildAvatarSrc(useTEM.currentTeam?.teamImgPath),
        id: `inbox:${item.itemId}`,
        title,
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
// Loose envelope shape for the WS-tagged payload that dispatches into
// the typed builders below. The `wsType` discriminant decides which
// inner cast (NewMessageProps / NewThreadMessageProps / ActivityMessageProps
// / { data: InboxItemProps }) is valid for the actual contents.
type WSNotificationMessage = {
    wsType?: string;
    isThread?: boolean;
    data?: unknown;
    alreadyExist?: boolean;
};

export const buildIntentFromMessage = (
    message: WSNotificationMessage | null | undefined,
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
