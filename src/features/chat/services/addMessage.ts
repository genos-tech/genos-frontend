import AddMessageWorker from "../../../workers/addMessageWorker.ts?worker";
import { MessageProps } from "../../../types/chat";

export const addMessage = (message: MessageProps, isDm: boolean): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addMessageWorker = new AddMessageWorker();

        addMessageWorker.postMessage({ message: message, isDm: isDm });

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
