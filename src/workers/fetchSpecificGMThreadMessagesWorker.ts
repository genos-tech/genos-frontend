import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const threadId: number = event.data.threadId;

    if (chatId !== undefined && threadId !== undefined) {
        const gmThreadMessages = await messageIdWithChatId({
            storeName: STORES.GM_THREAD_MESSAGES,
            chatId: chatId,
            threadId: threadId
        })

        // Sort messages by tsSent in ascending order
        const sortedMessages = [...gmThreadMessages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        self.postMessage([]);
    }
};

export { };
