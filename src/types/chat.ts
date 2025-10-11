import { PartialBlock } from "@blocknote/core";
import { UserProps } from "./admin";
import { ReactionProps } from "./common";
import { ProjectProps } from "./tasks";

// Chat Props
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
    isRead: boolean;
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
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    taskExist?: boolean;
    taskId: number | null;
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
    tsSent: string;
    tsUpdated: string;
    numReplies: number;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    taskId: number | null;
    taskStatus: string | null;
    project?: ProjectProps;
    isEdited: boolean;
    reactions?: ReactionProps[];
    lastReadMessageId: number;
    isPinned?: boolean;
    tsLastAllReadActivity?: string;
    isFlagged?: boolean;
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

export type ToDoFactProps = {
    todoId: number;
    todoContent: PartialBlock[] | any[];
    isCompleted: boolean;
    dtCreatedOn: string;
    tsCreatedAt: string;
    tsUpdatedAt: string;
};
