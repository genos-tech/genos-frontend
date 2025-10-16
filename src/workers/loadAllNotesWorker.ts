import { STORES } from "../db/conf";
import { clearStore, miniBatchInsert } from "../db/crud";
import { loadAllChatNotes } from "../features/notes/chat-notes/services/loadAllChatNotes";
import { loadAllMyNotes } from "../features/notes/my-notes/services/loadAllMyNotes";
import { loadAllTaskNotes } from "../features/notes/task-notes/services/loadAllTaskNotes";
import { UserProps } from "../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../types/notes";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.PERSONAL_NOTES);
    await clearStore(STORES.TASK_NOTES);
    await clearStore(STORES.CHAT_NOTES);

    // Load data from backend
    const myNotes: MyNoteProps[] = await loadAllMyNotes(myself, accessToken);
    const taskNotes: TaskNoteProps[] = await loadAllTaskNotes(myself, accessToken);
    const chatNotes: ChatNoteProps[] = await loadAllChatNotes(myself, accessToken);

    for (let i = 0; i < myNotes.length; i += BATCH_SIZE) {
        const miniBatchTasks: MyNoteProps[] = myNotes.slice(i, i + BATCH_SIZE);
        await miniBatchInsert({
            storeName: STORES.PERSONAL_NOTES,
            miniBatch: miniBatchTasks,
        });
    }

    for (let i = 0; i < taskNotes.length; i += BATCH_SIZE) {
        const miniBatchTasks: TaskNoteProps[] = taskNotes.slice(i, i + BATCH_SIZE);
        await miniBatchInsert({
            storeName: STORES.TASK_NOTES,
            miniBatch: miniBatchTasks,
        });
    }

    for (let i = 0; i < chatNotes.length; i += BATCH_SIZE) {
        const miniBatchTasks: ChatNoteProps[] = chatNotes.slice(i, i + BATCH_SIZE);
        await miniBatchInsert({
            storeName: STORES.CHAT_NOTES,
            miniBatch: miniBatchTasks,
        });
    }
    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
