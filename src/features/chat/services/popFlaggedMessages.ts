import { FlaggedMessageProps } from "../../../types/chat";
import PopFlaggedMessagesWorker from "../../../workers/popFlaggedMessagesWorker.ts?worker";

export const popFlaggedMessages = (): Promise<FlaggedMessageProps[]> => {
    return new Promise((resolve, reject) => {
        const popFlaggedMessagesWorker = new PopFlaggedMessagesWorker();

        popFlaggedMessagesWorker.postMessage({});

        popFlaggedMessagesWorker.onmessage = (event) => {
            popFlaggedMessagesWorker.terminate();
            resolve(event.data as FlaggedMessageProps[]);
        };

        popFlaggedMessagesWorker.onerror = (error) => {
            popFlaggedMessagesWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
