import { ThreadMessageProps } from '../../../types/types';
import AddThreadMessageWorker from "../../../workers/addThreadMessageWorker.ts?worker";


export const addThreadMessage = (
    threadMessage: ThreadMessageProps,
    isDm: boolean
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addThreadMessageWorker = new AddThreadMessageWorker();

        addThreadMessageWorker.postMessage({ threadMessage: threadMessage, isDm: isDm });

        addThreadMessageWorker.onmessage = (event) => {
            addThreadMessageWorker.terminate();
            resolve(null);
        };

        addThreadMessageWorker.onerror = (error) => {
            addThreadMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
