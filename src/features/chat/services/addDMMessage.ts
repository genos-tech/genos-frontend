import InsertDMMessageWorker from "../../../workers/insertDMMessageWorker.ts?worker";
import { MessageProps } from "../../../types/types";

export const addDMMessage = (
    dmMessage: MessageProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addDMMessageWorker = new InsertDMMessageWorker();

        addDMMessageWorker.postMessage({ dmMessage: dmMessage });

        addDMMessageWorker.onmessage = (event) => {
            addDMMessageWorker.terminate();
            resolve(null);
        };

        addDMMessageWorker.onerror = (error) => {
            addDMMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
