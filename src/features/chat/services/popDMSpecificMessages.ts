import { MessageProps } from '../../../types/types';
import FetchSpecificDMMessagesWorker from "../../../workers/fetchSpecificDMMessagesWorker.ts?worker";

export const popDMSpecificMessages = (
    chatId: number,
): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificDMMessagesWorker = new FetchSpecificDMMessagesWorker();

        popSpecificDMMessagesWorker.postMessage({
            chatId,
        });

        popSpecificDMMessagesWorker.onmessage = (event) => {
            popSpecificDMMessagesWorker.terminate();
            resolve(event.data as MessageProps[]);
        };

        popSpecificDMMessagesWorker.onerror = (error) => {
            popSpecificDMMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
