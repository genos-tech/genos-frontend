import InsertGMChatWorker from "../../../workers/insertGMChatWorker.ts?worker";
import { AllChatProps } from "../../../types/types";

export const addGMChat = (
    gmChat: AllChatProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addGMChatWorker = new InsertGMChatWorker();

        addGMChatWorker.postMessage({ gmChat: gmChat });

        addGMChatWorker.onmessage = (event) => {
            addGMChatWorker.terminate();
            resolve(null);
        };

        addGMChatWorker.onerror = (error) => {
            addGMChatWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
