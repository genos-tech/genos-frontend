import AddNoteWorker from "../../../workers/addNoteWorker.ts?worker";
import { NoteProps } from "../../../types/notes";

export const addNote = (note: NoteProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addNoteWorker = new AddNoteWorker();

        addNoteWorker.postMessage({ note: note });

        addNoteWorker.onmessage = (event) => {
            addNoteWorker.terminate();
            resolve(null);
        };

        addNoteWorker.onerror = (error) => {
            addNoteWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
