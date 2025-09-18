import { STORES } from "../db/conf";
import { getSpecificDataWithIndex } from "../db/crud";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_CHATS,
    2: STORES.GM_CHATS,
    3: STORES.PM_CHATS,
};

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    if (chatId && chatType !== undefined) {
        const chat = await getSpecificDataWithIndex({
            storeName: storeNameLookup[chatType],
            chatId: chatId,
        });

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
