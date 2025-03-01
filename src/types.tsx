// User Props
export type UserProps = {
    userName: string;
    userEmail: string;
    avatarImgPath: string;
    online: boolean | false;
};

// Chat Props
export type AllChatProps = {
    chatName: string;
    chatEmail: string;
    isDm: boolean;
    unread: boolean | true;
    latestMessage?: MessageProps;
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

export type ChatProps = {
    chatName: string;
    chatEmail: string;
    isDm: boolean;
    unread: boolean | true;
    messages: MessageProps[];
    latestMessage?: MessageProps;
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

// Thread Props
export type ThreadProps = {
    chatName: string;
    chatEmail: string;
    threadId: string;
    isDm: boolean;
    unread: boolean | true;
    messages: ThreadMessageProps[];
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

// Message Props
export type MessageProps = {
    messageIdWithChatEmail?: string;
    messageId: string;
    chatEmail: string;
    content: string;
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
    messageIdWithChatEmailAndThreadId: string
    threadId: string;
    messageId: string;
    chatEmail: string;
    content: string;
    sender: UserProps;
    tsSent: string;
    isLiked?: boolean | false;
    attachment?: {
        fileName: string;
        type: string;
        size: string;
    };
};

export type NewMessageProps = {
    messageId: string;
    chatEmail: string;
    chatName: string;
    isDm: boolean;
    isThread: boolean;
    content: string;
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
    threadId: string,
    messageId: string;
    chatEmail: string;
    chatName: string;
    isDm: boolean;
    isThread: boolean;
    content: string;
    sender: UserProps;
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
    type: string,
    email: string,
    name: string
}

export type LoadSearchListResponse = {
    searchList: SearchListProps[] | [],
    message: string,
};

export type LoadDMMessageHistoryResponse = {
    messageHistory: ChatProps[] | [],
    message: string,
};

export type LoadGMMessageHistoryResponse = {
    messageHistory: ChatProps[] | [],
    message: string,
};
