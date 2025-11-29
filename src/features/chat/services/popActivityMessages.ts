import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";
import PopActivityMessagesWorker from "../../../db/workers/popActivityMessagesWorker.ts?worker";

export const popActivityMessages = (myself: UserProps): Promise<ActivityMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popActivityMessagesWorker = new PopActivityMessagesWorker();

        popActivityMessagesWorker.postMessage({ myself });

        popActivityMessagesWorker.onmessage = (event) => {
            popActivityMessagesWorker.terminate();
            resolve(event.data as ActivityMessageProps[]);
        };

        popActivityMessagesWorker.onerror = (error) => {
            popActivityMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
