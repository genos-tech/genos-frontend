import { STORES } from "../config";
import { ChatRepository } from "../repositories";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_CHATS,
    2: STORES.GM_CHATS,
    3: STORES.PM_CHATS,
    4: STORES.MDM_CHATS,
};

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    if (chatId && chatType !== undefined) {
        const chatRepository = new ChatRepository(storeNameLookup[chatType]);
        const chat = await chatRepository.getChat(chatId);

        if (chat) {
            self.postMessage(chat);
        } else {
            self.postMessage([]);
        }
    } else {
        console.error("Invalid parameters for popSpecificChatWorker:", {
            chatId: chatId,
            chatType: chatType,
        });
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
