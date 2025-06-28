import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const threadId: number = event.data.threadId;
    const isDm: boolean = event.data.isDm;

    if (chatId && threadId && isDm !== undefined) {
        const dmThreadMessages = await messageIdWithChatId({
            storeName: isDm ? STORES.DM_THREAD_MESSAGES : STORES.GM_THREAD_MESSAGES,
            chatId: chatId,
            threadId: threadId,
        });

        // Sort messages by tsSent in ascending order
        const sortedMessages = [...dmThreadMessages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        console.error("Invalid parameters for popSpecificThreadMessagesWorker:", {
            chatId: chatId,
            threadId: threadId,
            isDm: isDm,
        });
        self.postMessage([]);
    }
};

export {};
