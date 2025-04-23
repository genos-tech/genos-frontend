import { ThreadMessageProps } from '../../../types/types';
import InsertDMThreadMessageWorker from "../../../workers/insertDMThreadMessageWorker.ts?worker";


export const addDMThreadMessage = (
    threadMessage: ThreadMessageProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addDMThreadMessageWorker = new InsertDMThreadMessageWorker();

        addDMThreadMessageWorker.postMessage({ dmThreadMessage: threadMessage });

        addDMThreadMessageWorker.onmessage = (event) => {
            addDMThreadMessageWorker.terminate();
            resolve(null);
        };

        addDMThreadMessageWorker.onerror = (error) => {
            addDMThreadMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
