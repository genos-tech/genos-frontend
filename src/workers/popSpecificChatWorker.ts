import { STORES } from "../db/conf";
import { getSpecificDataWithIndex } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const isDm: boolean = event.data.isDm;

    if (chatId && isDm !== undefined) {
        const chat = await getSpecificDataWithIndex({
            storeName: isDm ? STORES.DM_CHATS : STORES.GM_CHATS,
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
            isDm: isDm,
        });
        self.postMessage([]);
    }
};

export {};
