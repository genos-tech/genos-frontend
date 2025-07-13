import AddChatWorker from "../../../workers/addChatWorker.ts?worker";
import { AllChatProps } from "../../../types/chat";

export const addChat = (chat: AllChatProps, isDm: boolean, chatType: number): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addChatWorker = new AddChatWorker();

        addChatWorker.postMessage({ chat: chat, isDm: isDm, chatType: chatType });

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
