import { STORES } from "../db/conf";
import { getSpecificDataWithIndex } from "../db/crud";

self.onmessage = async (event) => {
    const chatId: string = event.data.chatId;
    const dmChats = await getSpecificDataWithIndex({
        storeName: STORES.DM_CHATS,
        chatId: chatId
    })
    if (dmChats) {
        self.postMessage(dmChats);
    } else {
        self.postMessage([]);
    }
};

export { };
