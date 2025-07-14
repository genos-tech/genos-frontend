import { MessageProps } from "../../../types/chat";
import PopSpecificMessagesWorker from "../../../workers/popSpecificMessagesWorker.ts?worker";

export const popSpecificMessages = (chatId: number, chatType: number): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificMessagesWorker = new PopSpecificMessagesWorker();

        popSpecificMessagesWorker.postMessage({
            chatId,
            chatType,
        });

        popSpecificMessagesWorker.onmessage = (event) => {
            popSpecificMessagesWorker.terminate();
            resolve(event.data as MessageProps[]);
        };

        popSpecificMessagesWorker.onerror = (error) => {
            popSpecificMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
