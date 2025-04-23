import InsertDMChatWorker from "../../../workers/insertDMChatWorker.ts?worker";
import { AllChatProps } from "../../../types/types";

export const addDMChat = (
    dmChat: AllChatProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addDMChatWorker = new InsertDMChatWorker();

        addDMChatWorker.postMessage({ dmChat: dmChat });

        addDMChatWorker.onmessage = (event) => {
            addDMChatWorker.terminate();
            resolve(null);
        };

        addDMChatWorker.onerror = (error) => {
            addDMChatWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
