import { PartialBlock } from "@blocknote/core";

export type MyNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type MyNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: MyNoteProps[];
};

export type MyNoteMetaTreeNode = MyNoteMetaProps & {
    children: MyNoteMetaTreeNode[];
};

export type TaskNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    projectId: number;
    taskId: number;
    projectName?: string;
    taskTitle?: string;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type TaskNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    projectId: number;
    taskId: number;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: TaskNoteProps[];
};

export type TaskNoteMetaTreeNode = TaskNoteMetaProps & {
    children: TaskNoteMetaTreeNode[];
};

export type ChatNoteMetaProps = {
    noteType: number;
    noteId: number;
    parentNoteId: number | null;
    chatType: number;
    chatTypeName?: string;
    chatName?: string;
    chatId: number;
    isThread: boolean;
    threadId: number;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type ChatNoteProps = {
    noteType: number;
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    chatType: number;
    chatId: number;
    isThread: boolean;
    threadId: number;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: ChatNoteProps[];
};

export type ChatNoteMetaTreeNode = ChatNoteMetaProps & {
    children: ChatNoteMetaTreeNode[];
};
