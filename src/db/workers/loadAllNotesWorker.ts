import { loadAllChatNotes } from "../../features/notes/chat-notes/services/loadAllChatNotes";
import { loadAllMyNotes } from "../../features/notes/my-notes/services/loadAllMyNotes";
import { loadAllTaskNotes } from "../../features/notes/task-notes/services/loadAllTaskNotes";
import { NoteRepositoryFactory } from "../repositories";
import { NoteService } from "../services";
import { UserProps } from "../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const personalNoteRepo = NoteRepositoryFactory.createPersonalNoteRepository();
    const taskNoteRepo = NoteRepositoryFactory.createTaskNoteRepository();
    const chatNoteRepo = NoteRepositoryFactory.createChatNoteRepository();

    await personalNoteRepo.clear();
    await taskNoteRepo.clear();
    await chatNoteRepo.clear();

    // Load data from backend
    const myNotes: MyNoteProps[] = await loadAllMyNotes(myself, accessToken);
    const taskNotes: TaskNoteProps[] = await loadAllTaskNotes(myself, accessToken);
    const chatNotes: ChatNoteProps[] = await loadAllChatNotes(myself, accessToken);

    for (let i = 0; i < myNotes.length; i += BATCH_SIZE) {
        const miniBatchNotes: MyNoteProps[] = myNotes.slice(i, i + BATCH_SIZE);
        await new NoteService().batchInsertPersonalNotes(miniBatchNotes);
    }

    for (let i = 0; i < taskNotes.length; i += BATCH_SIZE) {
        const miniBatchNotes: TaskNoteProps[] = taskNotes.slice(i, i + BATCH_SIZE);
        await new NoteService().batchInsertTaskNotes(miniBatchNotes);
    }

    for (let i = 0; i < chatNotes.length; i += BATCH_SIZE) {
        const miniBatchNotes: ChatNoteProps[] = chatNotes.slice(i, i + BATCH_SIZE);
        await new NoteService().batchInsertChatNotes(miniBatchNotes);
    }
    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
