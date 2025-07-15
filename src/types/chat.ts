import { PartialBlock } from "@blocknote/core";
import { UserProps } from "./admin";

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
    isLiked?: boolean | false;
    numReplies: number;
    unreadThread?: boolean | true;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
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
    isLiked?: boolean | false;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
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
    isLiked?: boolean | false;
    numReplies: number;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
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
    isLiked?: boolean | false;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
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

export type SearchTeamTasksResponse = {
    projectId: number;
    projectName: string;
    projectUserId: string;
    taskId: number;
    title: string;
    status: string;
};

export type CreateGMResponse = {
    chatId: number;
    chatName: string;
    message: string;
};
