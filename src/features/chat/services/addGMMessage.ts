import InsertGMMessageWorker from "../../../workers/insertGMMessageWorker.ts?worker";
import { MessageProps } from "../../../types/types";

export const addGMMessage = (
    gmMessage: MessageProps
): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addGMMessageWorker = new InsertGMMessageWorker();

        addGMMessageWorker.postMessage({ gmMessage: gmMessage });

        addGMMessageWorker.onmessage = (event) => {
            addGMMessageWorker.terminate();
            resolve(null);
        };

        addGMMessageWorker.onerror = (error) => {
            addGMMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
