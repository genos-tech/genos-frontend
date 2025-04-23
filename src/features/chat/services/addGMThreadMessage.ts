import {
    ThreadProps,
    ThreadMessageProps,
} from '../../../types/types';
import InsertGMThreadMessageWorker from "../../../workers/insertGMThreadMessageWorker.ts?worker";
import FetchSpecificGMThreadMessagesWorker from "../../../workers/fetchSpecificGMThreadMessagesWorker.ts?worker";
import { getCurrentTimestamp } from "../../../components/utils/getTime";


export const addGMThreadMessage = async (
    threadName: string,
    newGMThreadMessage: ThreadMessageProps,
    setCurrentThreadChat: (chat: ThreadProps) => void
): Promise<string> => {

    return new Promise((resolve, reject) => {
        // Insert the initial thread message (insert even if it already exists)
        const insertGMThreadMessageWorker = new InsertGMThreadMessageWorker();
        insertGMThreadMessageWorker.postMessage({ gmThreadMessage: newGMThreadMessage });
        insertGMThreadMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMThreadMessageWorker.terminate();

            // Fetch GM thread messages (new message and previous messages if exist)
            const fetchSpecificGMThreadMessagesWorker = new FetchSpecificGMThreadMessagesWorker();
            fetchSpecificGMThreadMessagesWorker.postMessage({
                chatId: newGMThreadMessage.chatId,
                threadId: newGMThreadMessage.threadId,
            });
            fetchSpecificGMThreadMessagesWorker.onmessage = (event) => {
                const fetchedMessages: ThreadMessageProps[] = event.data;
                if (fetchedMessages !== undefined) {
                    // set up states for thread
                    const newThread: ThreadProps = {
                        chatId: newGMThreadMessage.chatId,
                        chatName: threadName,
                        threadId: newGMThreadMessage.threadId,
                        isDm: false,
                        dmPartnerUserId: null,
                        taskId: null,
                        unread: false,
                        messages: fetchedMessages,
                        TSLastMessage: getCurrentTimestamp(),
                    };
                    setCurrentThreadChat(newThread)
                } else {
                    console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
                }
                resolve(event.data);
                fetchSpecificGMThreadMessagesWorker.terminate();
            };
            fetchSpecificGMThreadMessagesWorker.onerror = (error) => {
                reject(error);
                fetchSpecificGMThreadMessagesWorker.terminate();
            };
        };
        insertGMThreadMessageWorker.onerror = (error) => {
            reject(error);
            insertGMThreadMessageWorker.terminate();
        };
    });
};