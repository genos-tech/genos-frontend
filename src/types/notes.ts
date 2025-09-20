import { PartialBlock } from "@blocknote/core";

export type NoteProps = {
    teamId: string;
    ownerId: string;
    noteId: number;
    parentNoteId: number | null;
    title: string;
    body: PartialBlock[] | any[];
    tsCreated: string;
    tsUpdated: string;
};
