import { MessageProps } from '../../../types/types';
import FetchSpecificGMMessagesWorker from "../../../workers/fetchSpecificGMMessagesWorker.ts?worker";

export const popGMSpecificMessages = (
    chatId: number,
): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificGMMessagesWorker = new FetchSpecificGMMessagesWorker();

        popSpecificGMMessagesWorker.postMessage({
            chatId,
        });

        popSpecificGMMessagesWorker.onmessage = (event) => {
            popSpecificGMMessagesWorker.terminate();
            resolve(event.data as MessageProps[]);
        };

        popSpecificGMMessagesWorker.onerror = (error) => {
            popSpecificGMMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
