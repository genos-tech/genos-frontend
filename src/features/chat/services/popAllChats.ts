import { AllChatProps } from '../../../types/chat';
import PopAllChatsWorker from "../../../workers/popAllChatsWorker.ts?worker";

export const popAllChats = (): Promise<AllChatProps[]> => {
    return new Promise((resolve, reject) => {
        const popAllChatsWorker = new PopAllChatsWorker();

        popAllChatsWorker.postMessage({});

        popAllChatsWorker.onmessage = (event) => {
            popAllChatsWorker.terminate();
            resolve(event.data as AllChatProps[]);
        };

        popAllChatsWorker.onerror = (error) => {
            popAllChatsWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
