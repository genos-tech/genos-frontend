import { notesChannel } from "../../../../db/workers/channels";

// `note` is `any` here to keep the legacy caller surface (where partially
// hydrated note objects are passed) compatible. The repository layer is the
// authoritative place for type-narrowing.
export const addNote = (noteType: number, note: any): Promise<null> => {
    return notesChannel.request("addNote", { note, noteType }).then(() => null);
};
