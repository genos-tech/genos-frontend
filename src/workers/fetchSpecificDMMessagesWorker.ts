import { STORES } from "../components/indexedDBUtils/conf";
import { messageIdWithChatId } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const dmMessages = await messageIdWithChatId({
        storeName: STORES.DM_MESSAGES,
        chatId: chatId
    })

    // Sort messages by tsSent in ascending order
    const sortedMessages = [...dmMessages].sort((a, b) => {
        return Number(a.messageId) - Number(b.messageId);
    });

    self.postMessage(sortedMessages);
};

export { };
