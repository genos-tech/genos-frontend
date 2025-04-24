import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const isDm: boolean = event.data.isDm;

    if (chatId && isDm !== undefined) {
        const messages = await messageIdWithChatId({
            storeName: isDm ? STORES.DM_MESSAGES : STORES.GM_MESSAGES,
            chatId: chatId
        })
        // Sort messages by tsSent in ascending order
        const sortedMessages = [...messages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        console.error
            ("Invalid parameters for popSpecificMessagesWorker:", {
                chatId: chatId,
                isDm: isDm,
            });
        self.postMessage([]);
    }
};

export { };
