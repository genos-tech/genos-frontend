import { PartialBlock } from "@blocknote/core";

export type NoteMetaProps = {
    noteId: number;
    parentNoteId: number | null;
    title: string;
    tsCreated: string;
    tsUpdated: string;
    error?: string;
};

export type NoteProps = {
    teamId: string;
    ownerId: string;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
    error?: string;
};
