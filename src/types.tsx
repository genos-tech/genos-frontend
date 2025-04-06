// User Props
export type UserProps = {
    teamId: string;
    userId: string;
    userName: string;
    userEmail: string;
    avatarImgPath: string | null;
    online: boolean | false;
};

// Chat Props
export type AllChatProps = {
    chatId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
    unread: boolean | true;
    latestMessage?: MessageProps;
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

export type ChatProps = {
    chatId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
    unread: boolean | true;
    messages: MessageProps[];
    latestMessage?: MessageProps;
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage?: string;
};

// Thread Props
export type ThreadProps = {
    chatId: number;
    chatName: string;
    threadId: number;
    isDm: boolean;
    dmPartnerUserId: string | null;
    unread: boolean | true;
    messages: ThreadMessageProps[];
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

// Message Props
export type MessageProps = {
    messageIdWithChatId?: string;
    chatId: number;
    messageId: number;
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
    messageIdWithChatIdAndThreadId: string
    chatId: number;
    threadId: number;
    messageId: number;
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
    chatId: number;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
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
    chatId: number;
    threadId: number;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
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

// Task
export type ProjectProps = {
    id: number,
    name: string,
    color: string | "primary"
}

export type TaskStatusProps = {
    code: number,
    status: string,
    color: string,
}

export type TaskPriorityProps = {
    code: number,
    priority: string,
    color: string,
}

export type TaskEffortLevelProps = {
    code: number,
    level: string,
    color: string,
}

export type UploadingFileProps = {
    file: File
}

export type CreateTaskProps = {
    project: ProjectProps,
    title: string,
    body: string,
    assignee: UserProps,
    reporter: UserProps,
    dueDate: string,
    status: TaskStatusProps, // {0: open, 1: wip, 2: close, 3: deleted}
    priority: TaskPriorityProps, // {0: low, 1: medium, 2: high}
    effortLevel: TaskEffortLevelProps, // {0: low, 1: medium, 2: high}
    tags: {
        tag: string,
        color: string
    }[],
    githubLink: {
        url: string,
        title: string
    },
    generalLink: {
        url: string,
        title: string
    },
    attachments: UploadingFileProps[],
}

export type PreviewTaskProps = {
    id: string,
    project: ProjectProps,
    title: string,
    body: string,
    assignee: UserProps,
    reporter: UserProps,
    dueDate: string,
    createdDate: string,
    daysLeft: string,
    status: TaskStatusProps, // {0: open, 1: wip, 2: close, 3: deleted}
    priority: TaskPriorityProps, // {0: low, 1: medium, 2: high}
    effortLevel: TaskEffortLevelProps, // {0: low, 1: medium, 2: high}
    tags: {
        tag: string,
        color: string
    }[],
    githubLink: {
        url: string,
        title: string
    },
    generalLink: {
        url: string,
        title: string
    },
    attachments: UploadingFileProps[],
    parentTaskId: string,
    threadId: string,
}

export type TaskTableProps = {
    id: string,
    title: string,
    priority: string,
    effortLevel: string,
    createdDate: string,
    dueDate: string,
    daysLeft: string,
    status: string,
    assigneeId: string,
    assigneeEmail: string,
    assigneeName: string,
    parentTaskId: string,
    threadId: string,
    tags: {
        tag: string,
        color: string,
    }[],
    teamId: string,
    projectId: string
}

// Other Props
export type SearchListProps = {
    id: number,
    type: string,
    name: string,
    email: string | null,
    dmPartnerUserId: string | null,
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
