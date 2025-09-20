import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { NoteProps } from "../types/notes";

self.onmessage = async (event) => {
    const note: NoteProps = event.data.note;

    await addData({
        storeName: STORES.NOTES,
        data: note,
    });

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
