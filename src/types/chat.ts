import { PartialBlock } from "@blocknote/core";

import { UserProps } from "./admin";
import { ReactionProps } from "./common";
import { ProjectProps } from "./tasks";

// Chat Props
export type MDMMemberProps = {
    userId: string;
    userName: string;
    userEmail?: string;
    avatarImgPath?: string;
    teamId?: string;
    teamName?: string;
};

export type AllChatProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    dmPartnerUser: UserProps;
    lastReadMessageId: number;
    latestMessage: MessageProps;
    latestMessageText: string;
    TSLastMessage: string;
    project?: ProjectProps;
    isPrivate?: boolean;
    profileImagePath?: string;
    isPinned?: boolean;
    tsLastAllReadActivity?: string;
    mdmMembers?: MDMMemberProps[];
};

export type ChatProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    dmPartnerUser: UserProps;
    lastReadMessageId: number;
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
    tsCreatedAt: string;
};

// Activity Message Props
export type ActivityMessageProps = {
    activityId: string;
    activityType: number;
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
export type SearchListProps = {
    id: number;
    type: string;
    name: string;
    email: string | null;
    dmPartnerUser: UserProps;
    isPrivate: boolean;
    isJoined: boolean;
    profileImagePath?: string;
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
export type TodoItemProps = {
    itemId: number;
    groupId: number;
    categoryId: number | null;
    title: string;
    notes: PartialBlock[] | null;
    isCompleted: boolean;
    sortOrder: number;
    tsCreatedAt: string;
    tsUpdatedAt: string;
    tsCompletedAt: string | null;
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
