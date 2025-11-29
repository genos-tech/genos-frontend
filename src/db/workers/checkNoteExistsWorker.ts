import { NoteService } from "../services";

self.onmessage = async (event) => {
    const noteType: number = event.data.noteType;
    const noteId: number = event.data.noteId;

    let exists: boolean = false;
    const noteService = new NoteService();

    if (noteType === 1) {
        exists = await noteService.personalNoteExists(noteId);
    } else if (noteType === 2) {
        exists = await noteService.taskNoteExists(noteId);
    } else if (noteType === 3) {
        exists = await noteService.chatNoteExists(noteId);
    }

    self.postMessage(exists);

    self.close(); // Terminates itself
};

export {};
