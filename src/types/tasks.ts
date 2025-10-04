import { PartialBlock } from "@blocknote/core";
import { UserProps } from "./admin";
import { ReactionProps } from "./common";

export type TagColorOption = {
    name: string;
    value: string;
    textColor: string;
};

export type AttachmentFileProps = {
    attachment_id: number;
    file: File;
    file_base64?: string;
    name?: string;
    type?: string;
};

export type TagListProps = {
    tagName: string;
    tagColor: string;
    tagTextColor: string;
};

export type ProjectProps = {
    projectId: number;
    projectName: string;
    projectTags: TagListProps[];
    isPrivate?: boolean;
    isJoined?: boolean;
    systemUserId?: string;
};

export type TaskPriorityProps = {
    code: number | null;
    priority: string | null;
    color: string | null;
    textColor: string | null;
};

export type TaskEffortLevelProps = {
    code: number | null;
    level: string | null;
    color: string | null;
    textColor: string | null;
};

export type TaskCommentProps = {
    taskId: number;
    senderId: string;
    senderName: string;
    commentId: number;
    commentBody: PartialBlock[] | any[];
    reactions?: ReactionProps[];
    tsSent: string;
    tsUpdated: string;
    isEdited: boolean;
};

export type TaskStatusProps = {
    code: number | null;
    status: string | null;
    color: string | null;
    textColor: string | null;
};

export type TaskListByTagProps = {
    projectId: number;
    projectName: string;
    tags: {
        tagName: string;
        tagColor: string;
        tasks: {
            taskId: number;
            title: string;
            status: string;
        }[];
    }[];
};

export type TaskProps = {
    id?: number;
    project: ProjectProps | null;
    title: string;
    body: PartialBlock[];
    assignee: UserProps;
    reporter: UserProps;
    chatType: number | null;
    chatId: number | null;
    threadId: number | null;
    dueDate: string;
    daysLeft?: number;
    createdDate?: string;
    updatedAt?: string;
    status: TaskStatusProps;
    priority: TaskPriorityProps;
    effortLevel: TaskEffortLevelProps;
    tags: TagListProps[];
    concatTags?: string;
    githubLink: {
        url: string;
        title: string;
    };
    generalLink: {
        url: string;
        title: string;
    };
    attachments: AttachmentFileProps[];
    parentTaskId: number | null;
    rootTaskId: number | null;
};

export type TaskTableProps = {
    id: string | null;
    title: string | null;
    priority: string | null;
    effortLevel: string | null;
    createdDate: string | null;
    updatedAt: string | null;
    dueDate: string | null;
    daysLeft: number | null;
    status: string | null;
    assigneeId: string | null;
    assigneeEmail: string | null;
    assigneeName: string | null;
    assigneeImgPath: string | null;
    parentTaskId: string | null;
    threadId: number | null;
    tags: TagListProps[];
    concatTags: string | null;
    teamId: string | null;
    projectId: number | null;
};

export type TaskType = {
    id: number;
    statuses: string[];
    name: string;
};

export type TaskTypesProps = {
    ongoing: TaskType;
    closed: TaskType;
    deleted: TaskType;
};

export type SearchTeamTasksResponse = {
    projectId: number;
    projectName: string;
    projectTags: TagListProps[];
    systemUserId: string;
    taskId: number;
    title: string;
    status: TaskStatusProps;
    tsUpdated: string;
};

export type FileProps = {
    attachmentId: number;
    url: string;
    name: string;
    width: number;
    height: number;
};

export type ImageSizeProps = {
    width: number;
    height: number;
};


export type TaskMetaProps = {
    taskId: number;
    parentTaskId: number | null;
    project: ProjectProps;
    title: string;
    status: TaskStatusProps;
    tsUpdated: string;
    error?: string;
};

export type TaskMetaTreeNode = TaskMetaProps & { children: TaskMetaTreeNode[] };
