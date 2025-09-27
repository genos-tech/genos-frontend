import AddNoteWorker from "../../../workers/addNoteWorker.ts?worker";

export const addNote = (noteType: number, note: any): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addNoteWorker = new AddNoteWorker();

        addNoteWorker.postMessage({ noteType: noteType, note: note });

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
