import { ActivityMessageProps } from "../../../types/chat";
import AddActivityMessageWorker from "../../../db/workers/addActivityMessageWorker.ts?worker";

export const addActivityMessage = (activityMessage: ActivityMessageProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addActivityMessageWorker = new AddActivityMessageWorker();

        addActivityMessageWorker.postMessage({ activityMessage: activityMessage });

        addActivityMessageWorker.onmessage = (event) => {
            addActivityMessageWorker.terminate();
            resolve(null);
        };

        addActivityMessageWorker.onerror = (error) => {
            addActivityMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
