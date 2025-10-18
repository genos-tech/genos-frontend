import { STORES } from "../db/config";
import { MessageRepository } from "../db/repositories";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_MESSAGES,
    2: STORES.GM_MESSAGES,
    3: STORES.PM_MESSAGES,
};

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    if (chatId && chatType !== undefined) {
        const messageRepository = new MessageRepository(storeNameLookup[chatType]);
        const messages = await messageRepository.getMessagesByChatId(chatType, chatId);

        self.postMessage(messages);
    } else {
        console.error("Invalid parameters for popSpecificMessagesWorker:", {
            chatId: chatId,
            chatType: chatType,
        });
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
