import { PartialBlock } from "@blocknote/core";

import { UserProps } from "./admin";
import { ReactionProps } from "./common";
import { ProjectProps } from "./tasks";

// Media a message body can carry that produces NO preview text of its
// own, so a list row has to be labelled from the blocks instead. See
// `derivePreviewMediaKind` in `features/chat/utils/common.ts`.
export type PreviewMediaKind = "gif" | "image" | "video" | "audio" | "file" | "table";

// Chat Props
export type MDMMemberProps = {
    userId: string;
    userName: string;
    userEmail?: string;
    avatarImgPath?: string;
    teamId?: string;
    teamName?: string;
};

// `chatId` was `number` in the legacy contract (per-type IntegerField
// PKs). The v3 backend uses UUIDs end-to-end; during the migration
// every chat-list / chat-detail surface adopts the UUID string in
// place. The rest of the legacy fields (e.g. `chatType`, the integer
// kind code) stay numeric for now — kind is genuinely an enum.
// `lastReadMessageId` follows the v3 Message id (UUID string) so the
// cursor model lines up with the message rows it points at.
export type AllChatProps = {
    chatType: number;
    chatId: string;
    chatName: string;
    systemUserId?: string;
    dmPartnerUser: UserProps;
    lastReadMessageId: string;
    latestMessage: MessageProps;
    latestMessageText: string;
    TSLastMessage: string;
    project?: ProjectProps;
    isPrivate?: boolean;
    /** A cross-team chat — drives the sidebar badge. Optional because
     *  every other chat kind and every cached pre-feature row lacks it. */
    isExternal?: boolean;
    /** The team that shared this chat with yours, set only when the chat
     *  is theirs. The host's own external chat leaves it null, so its
     *  presence is exactly "this room belongs to another team". */
    hostTeamName?: string | null;
    profileImagePath?: string;
    isPinned?: boolean;
    tsLastAllReadActivity?: string;
    mdmMembers?: MDMMemberProps[];
};

export type ChatProps = {
    chatType: number;
    chatId: string;
    chatName: string;
    systemUserId?: string;
    dmPartnerUser: UserProps;
    lastReadMessageId: string;
    messages: MessageProps[];
    latestMessage: MessageProps;
    latestMessageText: string;
    TSLastMessage: string;
    project?: ProjectProps;
    taskExist?: boolean;
    moveToSpecificIndex?: string;
    notMove?: boolean;
    isPrivate?: boolean;
    profileImagePath?: string;
    isPinned?: boolean;
    tsLastAllReadActivity?: string;
    mdmMembers?: MDMMemberProps[];
};

// Thread Props
export type ThreadProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    threadId: number;
    dmPartnerUser: UserProps;
    taskId: number | null;
    // Human-readable task identifier ("GEN-42") when this thread is
    // attached to a task. Falls back via `formatTaskDisplayId`.
    displayId?: string | null;
    messages: ThreadMessageProps[];
    TSLastMessage: string;
    project?: ProjectProps;
    taskExist?: boolean;
    moveToSpecificIndex?: string;
    notMove?: boolean;
    isPrivate?: boolean;
};

export type GMProfileProps = {
    gmId: number;
    gmName: string;
    ownerUserId: string;
    profileImagePath: string;
    gmMembers: UserProps[];
    isPrivate: boolean;
    /** A cross-team chat. Optional so cached pre-feature rows type-check. */
    isExternal?: boolean;
    tsCreatedAt: string;
};

// Activity Message Props
export type ActivityMessageProps = {
    activityId: string;
    activityType: number;
    // Which team's feed this row belongs to. The recipient may be in
    // several teams and the sidebar shows one at a time, so the feed
    // drops rows belonging to another team. Optional for rows that
    // predate the field, which are shown rather than hidden — see
    // `popActivityMessages`.
    teamId?: string;
    chatType: number;
    chatId: number;
    chatName: string;
    dmPartnerUserId: string;
    dmPartnerUserName: string;
    dmPartnerUserEmail: string;
    isThread: boolean;
    threadId: number;
    messageId: number;
    messageUniqueKey: string;
    threadMessageUniqueKey: string;
    taskId: number;
    displayId?: string | null;
    projectId?: number;
    projectName?: string;
    firstLineContent: string;
    // Set when the activity's message is media-only, so the feed can
    // label a row that has no `firstLineContent` at all (a GIF message
    // stores no preview text — see `derivePreviewMediaKind`). Absent on
    // rows cached before this field existed; they re-populate on the
    // next activity fetch.
    firstLineMediaKind?: PreviewMediaKind;
    latestReaction: {
        emoji: string;
        sender: UserProps;
        tsSent: string;
    };
    senderId: string;
    receiver: UserProps;
    reactions: ReactionProps[];
    tsSent: string;
    mentionedUserIds?: [];
    // Per-user "by group" filter source. Map of `userId → [groupId, ...]`
    // recording which mention-groups led to each user's inclusion.
    // Direct @user mentions don't appear here, so reading
    // `mentionedViaGroups[myUserId]` tells you the groups that put the
    // current user on this activity (empty / undefined = no group origin).
    // Populated by the backend mention handler on send; empty `{}` when
    // the message had no group mentions.
    mentionedViaGroups?: Record<string, number[]>;
    isRead: boolean;
    // Present on PM thread activities so the notification router can
    // recognize bot-narrated lifecycle messages (sender === systemUserId)
    // and suppress the self-attribution toast.
    systemUserId?: string;
    // True when the underlying message is a task comment (the v3 mirror
    // sets `message.metadata.taskCommentId`). Task comments live as PM
    // thread replies (chatType 3 + isThread) but are authored by a real
    // user — the notification router uses this to exempt them from the
    // bot-thread suppression and to route them to the task-comment
    // categories rather than mention_thread.
    isTaskComment?: boolean;
    // True when a SURFACE activity (task body / note, chatType 5/6/7/8) was
    // produced by a BlockNote INLINE COMMENT rather than the body itself —
    // set from `meta.isComment` by the surface adapter. Distinct from
    // `isTaskComment` (that flags the legacy task-comment feature on PM
    // thread mirrors). Drives two things: the notification router routes an
    // un-mentioned comment activity to the `comments` category, and the
    // activity feed chip labels the row as a comment.
    isComment?: boolean;
    // Parent-chat routing for CHAT-NOTE mentions (surface 8). The note's
    // own id rides in `chatId` for surface activities, so the chat the
    // note belongs to is carried separately here so a clicked chat-note
    // notification can build its deep URL. Only populated for surface 8
    // (and only once the backend includes them in the activity meta).
    noteChatType?: number;
    // Opaque: the parent chat id may be a numeric legacy id or a v3 UUID
    // string — carried as-is and stringified at the navigation boundary.
    noteChatId?: string | number;
    // Opaque too: a thread-root id is a v3 UUID string (legacy numeric on
    // old data). Coercing to a number drops the UUID, breaking thread
    // deep-links — carry it as-is, same as `noteChatId`.
    noteThreadId?: number | string;
};

export type MessageProps = {
    chatType: number;
    messageIdWithChatId?: string;
    chatId: number;
    systemUserId?: string;
    messageId: number;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    tsSent: string;
    tsUpdated: string;
    numReplies: number;
    // Task comment count for the bubble's linked task. Backend
    // populates this for PM (chatType === 3) bubbles only; the under-
    // bar chip uses it instead of `numReplies` because PM bubbles
    // surface task comments rather than auto-generated activity
    // replies. Optional + treated as 0 when absent so optimistic
    // message builders don't have to set it.
    taskCommentCount?: number;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    taskExist?: boolean;
    taskId: number | null;
    // Human-readable task identifier ("GEN-42") when the message is
    // linked to a task. Falls back via `formatTaskDisplayId` to
    // "#<taskId>" when absent (legacy rows, pre-backfill).
    displayId?: string | null;
    taskStatus: string | null;
    project?: ProjectProps;
    reactions?: ReactionProps[];
    threadId?: number;
    isFlagged?: boolean;
};

export type ThreadMessageProps = {
    chatType: number;
    messageIdWithChatIdAndThreadId: string;
    systemUserId?: string;
    chatId: number;
    threadId: number;
    messageId: number;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    taskId: number | null;
    // Human-readable task identifier ("GEN-42") when the thread is
    // linked to a task. Falls back via `formatTaskDisplayId`.
    displayId?: string | null;
    tsSent: string;
    tsUpdated: string;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    project?: ProjectProps;
    taskExist?: boolean;
    reactions?: ReactionProps[];
    isFlagged?: boolean;
};

export type NewMessageProps = {
    wsType: string;
    isReactionUpdated: boolean;
    chatType: number;
    chatId: number;
    isPrivate?: boolean;
    systemUserId?: string;
    messageId: number;
    chatName: string;
    dmPartnerUser: UserProps;
    isThread: boolean;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    receiver: UserProps;
    // Forwarded from the Flask broadcast so the notification router can
    // collapse the "chats" intent into the parallel "mentions" intent
    // when the same message also pushes an activity to the same user.
    mentionedUserIds?: string[];
    tsSent: string;
    tsUpdated: string;
    numReplies: number;
    // PM-only: post-event task comment count, computed server-side and
    // mirrored on `wsType: "chat"` PM broadcasts so the bubble's chip
    // can update without a refresh. Optional everywhere else.
    taskCommentCount?: number;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    taskId: number | null;
    taskStatus: string | null;
    // Human-readable task id ("<code>-<n>") on PM bubbles linked to a
    // task. Backend always sets this on the chat broadcast for PM
    // (see message_handlers.py:315); other chat types just pass
    // whatever the client emitted, defaulting to None.
    displayId?: string | null;
    project?: ProjectProps;
    isEdited: boolean;
    reactions?: ReactionProps[];
    lastReadMessageId: number;
    isPinned?: boolean;
    tsLastAllReadActivity?: string;
    isFlagged?: boolean;
    isDeleted?: boolean;
};

export type NewThreadMessageProps = {
    wsType: string;
    isReactionUpdated: boolean;
    chatType: number;
    chatId: number;
    systemUserId?: string;
    threadId: number;
    messageId: number;
    chatName: string;
    dmPartnerUser: UserProps;
    isThread: boolean;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    receiver: UserProps;
    // Same purpose as on NewMessageProps — lets the router drop the
    // `thread_replies` intent when the user is also being notified via
    // the activity mention path for the same broadcast.
    mentionedUserIds?: string[];
    taskId: number | null;
    tsSent: string;
    tsUpdated: string;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    project?: ProjectProps;
    taskExist?: boolean;
    isEdited: boolean;
    reactions?: ReactionProps[];
    isFlagged?: boolean;
    isDeleted?: boolean;
};

export type FlaggedMessageProps = {
    flaggedMessageId: string;
    chatType: number;
    chatName: string;
    chatId: number;
    threadId: number;
    messageId: number;
    contentText: string;
    sender: UserProps;
    dmPartnerUser: UserProps;
    project?: ProjectProps;
    taskId: number;
    // Human-readable task identifier; falls back via
    // `formatTaskDisplayId` to "#<taskId>" when absent.
    displayId?: string | null;
    tsSent: string;
};

// Other Props
// Chat-search result row. v3-native shape: People carry `userId`
// (DM-able directly), Groups carry `channelId` (openable directly).
// `legacyChatId` is retained for back-compat fallbacks while some
// surfaces still resolve by legacy id.
export type SearchListProps = {
    type: string; // "People" | "Group"
    name: string;
    // People
    userId?: string;
    email?: string | null;
    // Group
    channelId?: string;
    legacyChatId?: number | null;
    isPrivate?: boolean;
    isJoined?: boolean;
    // both
    profileImageUrl?: string;
};

export type LoadSearchListResponse = {
    searchList: SearchListProps[] | [];
    message: string;
};

export type LoadDMMessageHistoryResponse = {
    messageHistory: ChatProps[] | [];
    message: string;
};

export type LoadGMMessageHistoryResponse = {
    messageHistory: ChatProps[] | [];
    message: string;
};

export type CreateGMResponse = {
    chatId: number;
    chatName: string;
    message: string;
};

// Todo: free-form, per-user category label. Optional on items —
// uncategorized items render in an implicit top section.
export type TodoCategoryProps = {
    categoryId: number;
    name: string;
    sortOrder: number;
    tsCreatedAt: string;
    tsUpdatedAt: string;
};

// One actionable todo item. `notes` is an optional BlockNote document
// for rich-text detail; the `title` is the short label shown in the row.
// `parentItemId` is non-null on child items in a one-level nesting:
// children share the parent's tag and live inside the same group.
export type TodoItemProps = {
    itemId: number;
    groupId: number;
    categoryId: number | null;
    parentItemId: number | null;
    title: string;
    notes: PartialBlock[] | null;
    isCompleted: boolean;
    sortOrder: number;
    tsCreatedAt: string;
    tsUpdatedAt: string;
    tsCompletedAt: string | null;
};

// "Remind me about this to-do at 3pm" — the pending nudge on one item.
// At most one per item (the server cancels any prior one), and never sent
// down inside `TodoItemProps`: reminders are loaded by their own endpoint
// (`services/todoReminders`) because they change on their own schedule —
// one fires, or one is set on another device.
export type TodoReminderProps = {
    id: string;
    itemId: number;
    /** ISO instant, absolute — the browser computed it (see
     *  `features/chat/utils/reminderPresets`). */
    remindAt: string;
    tsCreated: string;
};

// A day's worth of todos. Created lazily on first item write — there's
// no longer an "isExistingTodaysTodo" flag; the group is just absent
// until the user adds an item.
export type TodoGroupProps = {
    groupId: number;
    localDate: string;
    isCompleted: boolean;
    items: TodoItemProps[];
    tsCreatedAt: string;
    tsUpdatedAt: string;
};

// A recurring rule that auto-creates a todo item into today's group.
// `rrule` is a calendar-style RRULE string (see features/calendar/utils/
// rrule.ts); the client expands it locally, creates the day's item, then
// advances `lastMaterializedDate`. `lastMaterializedDate` is the last
// local date an item was created for — the idempotency cursor that stops
// a re-open the same day from duplicating.
export type TodoScheduleProps = {
    scheduleId: number;
    categoryId: number | null;
    title: string;
    rrule: string;
    startDate: string;
    isActive: boolean;
    lastMaterializedDate: string | null;
    tsCreatedAt: string;
    tsUpdatedAt: string;
};
