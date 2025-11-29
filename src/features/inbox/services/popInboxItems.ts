import { InboxItemProps } from "../../../types/common";
import PopInboxItemsWorker from "../../../db/workers/popInboxItemsWorker.ts?worker";

export const popInboxItems = (): Promise<InboxItemProps[]> => {
    return new Promise((resolve, reject) => {
        const popInboxItemsWorker = new PopInboxItemsWorker();

        popInboxItemsWorker.postMessage({});

        popInboxItemsWorker.onmessage = (event) => {
            popInboxItemsWorker.terminate();
            resolve(event.data as InboxItemProps[]);
        };

        popInboxItemsWorker.onerror = (error) => {
            popInboxItemsWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
