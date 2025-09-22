import { loadAllMyNotes } from "../features/notes/services/loadAllMyNotes";
import { UserProps } from "../types/admin";
import { STORES } from "../db/conf";
import { clearStore, miniBatchInsert } from "../db/crud";
import { MyNoteProps } from "../types/notes";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.NOTES);

    // Load data from backend
    const notes: MyNoteProps[] = await loadAllMyNotes(myself, accessToken);

    for (let i = 0; i < notes.length; i += BATCH_SIZE) {
        const miniBatchTasks: MyNoteProps[] = notes.slice(i, i + BATCH_SIZE);
        await miniBatchInsert({
            storeName: STORES.NOTES,
            miniBatch: miniBatchTasks,
        });
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
