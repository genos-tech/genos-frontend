import CheckNoteExistsWorker from "../../../workers/checkNoteExistsWorker.ts?worker";

export const checkNoteExists = (noteId: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const checkNoteExistsWorker = new CheckNoteExistsWorker();

        checkNoteExistsWorker.postMessage({
            noteId,
        });

        checkNoteExistsWorker.onmessage = (event) => {
            checkNoteExistsWorker.terminate();
            resolve(event.data as boolean);
        };

        checkNoteExistsWorker.onerror = (error) => {
            checkNoteExistsWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
