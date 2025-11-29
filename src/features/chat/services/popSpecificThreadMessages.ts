import { ThreadMessageProps } from "../../../types/chat";
import PopSpecificThreadMessagesWorker from "../../../db/workers/popSpecificThreadMessagesWorker.ts?worker";

export const popSpecificThreadMessages = (
    chatId: number,
    threadId: number,
    chatType: number
): Promise<ThreadMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificThreadMessagesWorker = new PopSpecificThreadMessagesWorker();

        popSpecificThreadMessagesWorker.postMessage({
            chatId,
            threadId,
            chatType,
        });

        popSpecificThreadMessagesWorker.onmessage = (event) => {
            popSpecificThreadMessagesWorker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };

        popSpecificThreadMessagesWorker.onerror = (error) => {
            popSpecificThreadMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
