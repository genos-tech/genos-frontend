import AddInboxItemWorker from "../../../workers/addInboxItemWorker.ts?worker";
import {} from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";

export const addInboxItem = (inboxItem: InboxItemProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addInboxItemWorker = new AddInboxItemWorker();

        addInboxItemWorker.postMessage({ inboxItem: inboxItem });

        addInboxItemWorker.onmessage = (event) => {
            addInboxItemWorker.terminate();
            resolve(null);
        };

        addInboxItemWorker.onerror = (error) => {
            addInboxItemWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
