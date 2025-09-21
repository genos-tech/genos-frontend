import { PartialBlock } from "@blocknote/core";

export type MyNoteMetaProps = {
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsCreated: string;
    tsUpdated: string;
    error?: string;
};

export type MyNoteProps = {
    teamId: string;
    ownerId: string;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: MyNoteProps[];
};

export type MyNoteMetaTreeNode = MyNoteMetaProps & { children: MyNoteMetaTreeNode[] };

export type ChatNoteMetaProps = {
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsCreated: string;
    tsUpdated: string;
    error?: string;
};

export type ChatNoteProps = {
    teamId: string;
    ownerId: string;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: ChatNoteProps[];
};

export type ChatNoteMetaTreeNode = ChatNoteMetaProps & { children: ChatNoteMetaTreeNode[] };

export type TaskNoteMetaProps = {
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsCreated: string;
    tsUpdated: string;
    error?: string;
};

export type TaskNoteProps = {
    teamId: string;
    ownerId: string;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
    children?: TaskNoteProps[];
};

export type TaskNoteMetaTreeNode = TaskNoteMetaProps & { children: TaskNoteMetaTreeNode[] };
