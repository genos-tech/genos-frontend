import { ActivityMessageProps } from "../../../types/chat";
import PopActivityMessagesWorker from "../../../workers/popActivityMessagesWorker.ts?worker";

export const popActivityMessages = (): Promise<ActivityMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popActivityMessagesWorker = new PopActivityMessagesWorker();

        popActivityMessagesWorker.postMessage({});

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
