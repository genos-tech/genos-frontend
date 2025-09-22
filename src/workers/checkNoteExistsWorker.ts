import { STORES } from "../db/conf";
import { checkNoteExists } from "../db/utils";

self.onmessage = async (event) => {
    const noteType: number = event.data.noteType;
    const noteId: number = event.data.noteId;

    let exists: boolean = false;

    if (noteType === 1) {
        exists = await checkNoteExists(STORES.PERSONAL_NOTES, noteId);
    } else if (noteType === 2) {
        exists = await checkNoteExists(STORES.TASK_NOTES, noteId);
    } else if (noteType === 3) {
        exists = await checkNoteExists(STORES.CHAT_NOTES, noteId);
    }

    self.postMessage(exists);

    self.close(); // Terminates itself
};

export {};
