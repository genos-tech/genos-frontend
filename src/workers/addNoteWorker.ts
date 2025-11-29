import { NoteRepositoryFactory } from "../db/repositories";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../types/notes";

self.onmessage = async (event) => {
    const noteType: number = event.data.noteType;
    const note: MyNoteProps | TaskNoteProps | ChatNoteProps = event.data.note;

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
