import { AllChatProps } from "../../../types/chat";
import AddChatWorker from "../../../db/workers/addChatWorker.ts?worker";

export const addChat = (chat: AllChatProps, chatType: number): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addChatWorker = new AddChatWorker();

        addChatWorker.postMessage({ chat: chat, chatType: chatType });

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
