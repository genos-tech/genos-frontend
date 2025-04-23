import {
    ThreadProps,
    ThreadMessageProps,
} from '../../../types/types';
import InsertDMThreadMessageWorker from "../../../workers/insertDMThreadMessageWorker.ts?worker";
import FetchSpecificDMThreadMessagesWorker from "../../../workers/fetchSpecificDMThreadMessagesWorker.ts?worker";
import { getCurrentTimestamp } from "../../../components/utils/getTime";


export const addDMThreadMessage = async (
    threadName: string,
    dmPartnerUserId: string | null,
    newDMThreadMessage: ThreadMessageProps,
    setCurrentThreadChat: (chat: ThreadProps) => void
): Promise<string> => {

    return new Promise((resolve, reject) => {
        // Insert the initial thread message (insert even if it already exists)
        const insertDMThreadMessageWorker = new InsertDMThreadMessageWorker();
        insertDMThreadMessageWorker.postMessage({ dmThreadMessage: newDMThreadMessage });
        insertDMThreadMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMThreadMessageWorker.terminate();

            // Fetch DM thread messages (new message and previous messages if exist)
            const fetchSpecificDMThreadMessagesWorker = new FetchSpecificDMThreadMessagesWorker();
            fetchSpecificDMThreadMessagesWorker.postMessage({
                chatId: newDMThreadMessage.chatId,
                threadId: newDMThreadMessage.threadId,
            });
            fetchSpecificDMThreadMessagesWorker.onmessage = (event) => {
                const fetchedMessages: ThreadMessageProps[] = event.data;
                if (fetchedMessages !== undefined) {
                    // set up states for thread
                    const newThread: ThreadProps = {
                        chatId: newDMThreadMessage.chatId,
                        chatName: threadName,
                        threadId: newDMThreadMessage.threadId,
                        isDm: true,
                        dmPartnerUserId: dmPartnerUserId,
                        taskId: null,
                        unread: false,
                        messages: fetchedMessages,
                        TSLastMessage: getCurrentTimestamp(),
                    };
                    setCurrentThreadChat(newThread)
                } else {
                    console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages)
                }
                resolve(event.data);
                fetchSpecificDMThreadMessagesWorker.terminate();
            };
            fetchSpecificDMThreadMessagesWorker.onerror = (error) => {
                reject(error);
                fetchSpecificDMThreadMessagesWorker.terminate();
            };
        };
        insertDMThreadMessageWorker.onerror = (error) => {
            reject(error);
            insertDMThreadMessageWorker.terminate();
        };
    });
};