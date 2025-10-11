import AddFlaggedMessageWorker from "../../../workers/addFlaggedMessageWorker.ts?worker";
import { FlaggedMessageProps } from "../../../types/chat";

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
