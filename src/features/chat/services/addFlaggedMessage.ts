import { FlaggedMessageProps } from "../../../types/chat";
import AddFlaggedMessageWorker from "../../../db/workers/addFlaggedMessageWorker.ts?worker";

export const addFlaggedMessage = (message: FlaggedMessageProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addFlaggedMessageWorker = new AddFlaggedMessageWorker();

        addFlaggedMessageWorker.postMessage({ message: message });

        addFlaggedMessageWorker.onmessage = (event) => {
            addFlaggedMessageWorker.terminate();
            resolve(null);
        };

        addFlaggedMessageWorker.onerror = (error) => {
            addFlaggedMessageWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
