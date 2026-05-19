import { notesChannel } from "../../../../db/workers/channels";

export const checkNoteExists = (noteType: number, noteId: number): Promise<boolean> => {
    return notesChannel.request("checkNoteExists", { noteId, noteType });
};
