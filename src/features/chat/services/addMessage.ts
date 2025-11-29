import { MessageProps } from "../../../types/chat";
import AddMessageWorker from "../../../db/workers/addMessageWorker.ts?worker";

export const addMessage = (message: MessageProps, chatType: number): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addMessageWorker = new AddMessageWorker();

        addMessageWorker.postMessage({ message: message, chatType: chatType });

        addMessageWorker.onmessage = (event) => {
            addMessageWorker.terminate();
            resolve(null);
        };

        addMessageWorker.onerror = (error) => {
            addMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
