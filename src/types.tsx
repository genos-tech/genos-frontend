import { PartialBlock } from "@blocknote/core";

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
    latestMessageText: string;
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
    latestMessageText: string;
    CGAvatarImgPath?: string | '/path/to/CGAvatarImgPath.jpg';
    TSLastMessage: string;
};

// Thread Props
export type ThreadProps = {
    chatId: number;
    chatName: string;
    threadId: number;
    isDm: boolean;
    dmPartnerUserId: string | null;
    taskId: number | null;
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
    messageIdWithChatIdAndThreadId: string
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
    chatId: number;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
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
    chatId: number;
    threadId: number;
    messageId: number;
    chatName: string;
    isDm: boolean;
    dmPartnerUserId: string | null;
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

export type Team = {
    teamId: string,
    teamName: string,
    teamEmail: string,
}

// Task
export type ProjectProps = {
    projectId: number,
    projectName: string
}

export type TaskStatusProps = {
    code: number | null,
    status: string | null,
    color: string | null,
    textColor: string | null,
}

export type TaskPriorityProps = {
    code: number | null,
    priority: string | null,
    color: string | null,
    textColor: string | null,
}

export type TaskEffortLevelProps = {
    code: number | null,
    level: string | null,
    color: string | null,
    textColor: string | null,
}

export type TaskCommentProps = {
    taskId: number,
    senderId: string,
    senderName: string,
    commentId: number,
    commentBody: PartialBlock[] | any[],
    sentAt: string,
}


export type AttachmentFileProps = {
    file: File,
    file_base64?: string,
    name?: string,
    type?: string,
}

export type CreateTaskProps = {
    project: ProjectProps | null,
    title: string,
    body: PartialBlock[],
    assignee: UserProps,
    reporter: UserProps,
    chatType: string | null,
    chatId: number | null,
    threadId: number | null,
    dueDate: string,
    status: TaskStatusProps,
    priority: TaskPriorityProps,
    effortLevel: TaskEffortLevelProps,
    tags: TagListProps[],
    githubLink: {
        url: string,
        title: string
    },
    generalLink: {
        url: string,
        title: string
    },
    attachments: AttachmentFileProps[],
}

export type PreviewTaskProps = {
    id: string,
    project: ProjectProps,
    title: string | null,
    body: PartialBlock[],
    assignee: UserProps,
    reporter: UserProps,
    dueDate: string,
    createdDate: string,
    daysLeft: string,
    status: TaskStatusProps,
    priority: TaskPriorityProps,
    effortLevel: TaskEffortLevelProps,
    tags: TagListProps[],
    concatTags: string,
    githubLink: {
        url: string,
        title: string
    },
    generalLink: {
        url: string,
        title: string
    },
    attachments: AttachmentFileProps[],
    parentTaskId: string,
    threadId: string,
}

export type TaskTableProps = {
    id: string | null,
    title: string | null,
    priority: string | null,
    effortLevel: string | null,
    createdDate: string | null,
    dueDate: string | null,
    daysLeft: string | null,
    status: string | null,
    assigneeId: string | null,
    assigneeEmail: string | null,
    assigneeName: string | null,
    parentTaskId: string | null,
    threadId: string | null,
    tags: TagListProps[],
    concatTags: string | null,
    teamId: string | null,
    projectId: number | null
}

// Other Props
export type SearchListProps = {
    id: number,
    type: string,
    name: string,
    email: string | null,
    dmPartnerUserId: string | null,
}


export type TaskListByTagProps = {
    projectId: number,
    projectName: string,
    tags: {
        tagName: string,
        tagColor: string,
        tasks: {
            taskId: number,
            title: string,
            status: string,
        }[]
    }[]
}

export type TagListProps = {
    tagName: string,
    tagColor: string,
    tagTextColor: string,
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

export type SearchTeamTasksResponse = {
    projectId: number,
    projectName: string,
    taskId: number,
    title: string,
    status: string,
}
