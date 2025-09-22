import { STORES } from "../db/conf";
import { addData } from "../db/crud";

self.onmessage = async (event) => {
    const noteType: number = event.data.noteType;
    const note: any = event.data.note;

    if (noteType === 1) {
        await addData({
            storeName: STORES.PERSONAL_NOTES,
            data: note,
        });
    } else if (noteType === 2) {
        await addData({
            storeName: STORES.TASK_NOTES,
            data: note,
        });
    } else if (noteType === 3) {
        await addData({
            storeName: STORES.CHAT_NOTES,
            data: note,
        });
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
