import { ThreadMessageProps } from "../../../types/chat";
import PopSpecificThreadMessagesWorker from "../../../workers/popSpecificThreadMessagesWorker.ts?worker";

export const popSpecificThreadMessages = (
    chatId: number,
    threadId: number,
    isDm: boolean
): Promise<ThreadMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificThreadMessagesWorker = new PopSpecificThreadMessagesWorker();

        popSpecificThreadMessagesWorker.postMessage({
            chatId,
            threadId,
            isDm,
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
