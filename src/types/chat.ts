import { PartialBlock } from "@blocknote/core";
import { UserProps } from "./admin";
import { ReactionProps, GroupedReactionProps } from "./common";
import { ProjectProps } from "./tasks";

// Chat Props
export type AllChatProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    isDm: boolean;
    dmPartnerUser: UserProps | null;
    unread: boolean | true;
    latestMessage?: MessageProps;
    latestMessageText: string;
    CGAvatarImgPath?: string;
    TSLastMessage: string;
    project?: ProjectProps;
};

export type ChatProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    isDm: boolean;
    dmPartnerUser: UserProps | null;
    unread: boolean | true;
    messages: MessageProps[];
    latestMessage?: MessageProps;
    latestMessageText: string;
    CGAvatarImgPath?: string;
    TSLastMessage: string;
    project?: ProjectProps;
    taskExist?: boolean;
};

// Thread Props
export type ThreadProps = {
    chatType: number;
    chatId: number;
    chatName: string;
    systemUserId?: string;
    threadId: number;
    isDm: boolean;
    dmPartnerUser: UserProps | null;
    taskId: number | null;
    unread: boolean | true;
    messages: ThreadMessageProps[];
    CGAvatarImgPath?: string;
    TSLastMessage: string;
    project?: ProjectProps;
    taskExist?: boolean;
};

// Message Props
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
    isLiked?: boolean | false;
    numReplies: number;
    unreadThread?: boolean | true;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    taskExist?: boolean;
    taskId: number | null;
    taskStatus: string | null;
    project?: ProjectProps;
    reactions?: {
        myReactions: ReactionProps[];
        allReactions: ReactionProps[];
    };
    threadId?: number;
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
    isLiked?: boolean | false;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    project?: ProjectProps;
    taskExist?: boolean;
    reactions?: {
        myReactions: ReactionProps[];
        allReactions: ReactionProps[];
    };
};

export type NewMessageProps = {
    chatType: number;
    chatId: number;
    systemUserId?: string;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUser: UserProps | null;
    isThread: boolean;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    tsSent: string;
    tsUpdated: string;
    isLiked?: boolean | false;
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
    reactions?: {
        myReactions: ReactionProps[];
        allReactions: ReactionProps[];
    };
};

export type NewThreadMessageProps = {
    chatType: number;
    chatId: number;
    systemUserId?: string;
    threadId: number;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUser: UserProps | null;
    isThread: boolean;
    content: PartialBlock[] | any[];
    contentText: string;
    sender: UserProps;
    taskId: number | null;
    tsSent: string;
    tsUpdated: string;
    isLiked?: boolean | false;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
    project?: ProjectProps;
    taskExist?: boolean;
    isEdited: boolean;
    reactions?: {
        myReactions: ReactionProps[];
        allReactions: ReactionProps[];
    };
};

// Other Props
export type SearchListProps = {
    id: number;
    type: string;
    name: string;
    email: string | null;
    dmPartnerUserId: string;
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
