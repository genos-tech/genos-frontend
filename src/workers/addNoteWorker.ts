import { STORES } from "../db/conf";
import { NoteRepository, NoteRepositoryFactory } from "../db/repositories";

self.onmessage = async (event) => {
    const noteType: number = event.data.noteType;
    const note: any = event.data.note;

    if (noteType === 1) {
        const personalNoteRepo = NoteRepositoryFactory.createPersonalNoteRepository();
        await personalNoteRepo.put(note);
    } else if (noteType === 2) {
        const taskNoteRepo = NoteRepositoryFactory.createTaskNoteRepository();
        await taskNoteRepo.put(note);
    } else if (noteType === 3) {
        const chatNoteRepo = NoteRepositoryFactory.createChatNoteRepository();
        await chatNoteRepo.put(note);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
