import { STORES } from "../config";
import { ThreadMessageRepository } from "../repositories";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_THREAD_MESSAGES,
    2: STORES.GM_THREAD_MESSAGES,
    3: STORES.PM_THREAD_MESSAGES,
    4: STORES.MDM_THREAD_MESSAGES,
};

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const threadId: number = event.data.threadId;
    const chatType: number = event.data.chatType;

    if (chatId && threadId && chatType !== undefined) {
        const threadMessageRepository = new ThreadMessageRepository(storeNameLookup[chatType]);
        const dmThreadMessages = await threadMessageRepository.getThreadMessages(
            chatType,
            chatId,
            threadId
        );

        // Sort messages by tsSent in ascending order
        const sortedMessages = [...dmThreadMessages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        console.error("Invalid parameters for popSpecificThreadMessagesWorker:", {
            chatId: chatId,
            threadId: threadId,
            chatType: chatType,
        });
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
