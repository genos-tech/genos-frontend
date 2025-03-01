import { STORES } from "../components/indexedDBUtils/conf";
import { getSpecificDataWithIndex } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatEmail: string = event.data.chatEmail;
    const gmChats = await getSpecificDataWithIndex({
        storeName: STORES.GM_CHATS,
        chatEmail: chatEmail
    })
    self.postMessage(gmChats);
};

export { };
