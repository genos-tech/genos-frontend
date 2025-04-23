import { ThreadMessageProps } from '../../../types/types';
import FetchSpecificGMThreadMessagesWorker from "../../../workers/fetchSpecificGMThreadMessagesWorker.ts?worker";

export const popGMSpecificThreadMessage = (
    chatId: number,
    threadId: number
): Promise<ThreadMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificGMThreadMessagesWorker = new FetchSpecificGMThreadMessagesWorker();

        popSpecificGMThreadMessagesWorker.postMessage({
            chatId,
            threadId,
        });

        popSpecificGMThreadMessagesWorker.onmessage = (event) => {
            popSpecificGMThreadMessagesWorker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };

        popSpecificGMThreadMessagesWorker.onerror = (error) => {
            popSpecificGMThreadMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
