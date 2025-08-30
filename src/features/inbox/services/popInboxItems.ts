import { InboxProps } from "../../../types/common";
import PopInboxItemsWorker from "../../../workers/popInboxItemsWorker.ts?worker";

export const popInboxItems = (): Promise<InboxProps[]> => {
    return new Promise((resolve, reject) => {
        const popInboxItemsWorker = new PopInboxItemsWorker();

        popInboxItemsWorker.postMessage({});

        popInboxItemsWorker.onmessage = (event) => {
            popInboxItemsWorker.terminate();
            resolve(event.data as InboxProps[]);
        };

        popInboxItemsWorker.onerror = (error) => {
            popInboxItemsWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
