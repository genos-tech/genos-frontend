import { ThreadMessageProps } from "../../../types/chat";
import AddThreadMessageWorker from "../../../db/workers/addThreadMessageWorker.ts?worker";

export const addThreadMessage = (
    threadMessage: ThreadMessageProps,
    chatType: number
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addThreadMessageWorker = new AddThreadMessageWorker();

        addThreadMessageWorker.postMessage({
            threadMessage: threadMessage,
            chatType: chatType,
        });

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
