import { STORES } from "../db/conf";
import { getSpecificDataWithIndex } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: string = event.data.chatId;
    const gmChats = await getSpecificDataWithIndex({
        storeName: STORES.GM_CHATS,
        chatId: chatId
    })
    self.postMessage(gmChats);
};

export { };
