import { checkNoteExists } from "../db/utils";

self.onmessage = async (event) => {
    const noteId: number = event.data.noteId;

    const exists: boolean = await checkNoteExists(noteId);

    self.postMessage(exists);

    self.close(); // Terminates itself
};

export {};
