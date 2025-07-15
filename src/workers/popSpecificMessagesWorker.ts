import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_MESSAGES,
    2: STORES.GM_MESSAGES,
    3: STORES.PM_MESSAGES,
};

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    if (chatId && chatType !== undefined) {
        const messages = await messageIdWithChatId({
            storeName: storeNameLookup[chatType],
            chatId: chatId,
        });
        // Sort messages by tsSent in ascending order
        const sortedMessages = [...messages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        console.error("Invalid parameters for popSpecificMessagesWorker:", {
            chatId: chatId,
            chatType: chatType,
        });
        self.postMessage([]);
    }
};

export {};
