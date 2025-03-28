import { STORES } from "../components/indexedDBUtils/conf";
import { getSpecificDataWithIndex } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatId: string = event.data.chatId;
    const gmChats = await getSpecificDataWithIndex({
        storeName: STORES.GM_CHATS,
        chatId: chatId
    })
    self.postMessage(gmChats);
};

export { };
