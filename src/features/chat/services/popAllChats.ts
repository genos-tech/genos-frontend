import { AllChatProps } from '../../../types/chat';
import FetchAllChatsWorker from "../../../workers/fetchAllChatsWorker.ts?worker";

export const popAllChats = (): Promise<AllChatProps[]> => {
    return new Promise((resolve, reject) => {
        const popAllChatsWorker = new FetchAllChatsWorker();

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
