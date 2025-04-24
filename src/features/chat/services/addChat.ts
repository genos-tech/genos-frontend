import AddChatWorker from "../../../workers/addChatWorker.ts?worker";
import { AllChatProps } from "../../../types/types";

export const addChat = (
    chat: AllChatProps,
    isDm: boolean
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addChatWorker = new AddChatWorker();

        addChatWorker.postMessage({ chat: chat, isDm: isDm });

        addChatWorker.onmessage = (event) => {
            addChatWorker.terminate();
            resolve(null);
        };

        addChatWorker.onerror = (error) => {
            addChatWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
