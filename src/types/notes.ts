import { PartialBlock } from "@blocknote/core";

export type NoteMetaProps = {
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsUpdated: string;
    error?: string;
};

export type MyNoteProps = {
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

export type MyNoteMetaTreeNode = NoteMetaProps & { children: MyNoteMetaTreeNode[] };

export type ChatNoteProps = {
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

export type ChatNoteMetaTreeNode = NoteMetaProps & { children: ChatNoteMetaTreeNode[] };

export type TaskNoteProps = {
    teamId: string;
    ownerId: string;
    roleId: number;
    noteId: number;
    parentNoteId: number | null;
    taskId: number;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: TaskNoteProps[];
};

export type TaskNoteMetaTreeNode = NoteMetaProps & { children: TaskNoteMetaTreeNode[] };
