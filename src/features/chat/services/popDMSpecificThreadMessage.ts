import { ThreadMessageProps } from '../../../types/types';
import FetchSpecificDMThreadMessagesWorker from "../../../workers/fetchSpecificDMThreadMessagesWorker.ts?worker";

export const popDMSpecificThreadMessage = (
    chatId: number,
    threadId: number
): Promise<ThreadMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificDMThreadMessagesWorker = new FetchSpecificDMThreadMessagesWorker();

        popSpecificDMThreadMessagesWorker.postMessage({
            chatId,
            threadId,
        });

        popSpecificDMThreadMessagesWorker.onmessage = (event) => {
            popSpecificDMThreadMessagesWorker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };

        popSpecificDMThreadMessagesWorker.onerror = (error) => {
            popSpecificDMThreadMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
