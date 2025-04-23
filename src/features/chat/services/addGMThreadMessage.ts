import { ThreadMessageProps } from '../../../types/types';
import InsertGMThreadMessageWorker from "../../../workers/insertGMThreadMessageWorker.ts?worker";


export const addGMThreadMessage = (
    threadMessage: ThreadMessageProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addGMThreadMessageWorker = new InsertGMThreadMessageWorker();

        addGMThreadMessageWorker.postMessage({ gmThreadMessage: threadMessage });

        addGMThreadMessageWorker.onmessage = (event) => {
            addGMThreadMessageWorker.terminate();
            resolve(null);
        };

        addGMThreadMessageWorker.onerror = (error) => {
            addGMThreadMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
