import { STORES } from "../components/indexedDBUtils/conf";
import { getSpecificDataWithIndex } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatEmail: string = event.data.chatEmail;
    const dmChats = await getSpecificDataWithIndex({
        storeName: STORES.DM_CHATS,
        chatEmail: chatEmail
    })
    self.postMessage(dmChats);
};

export { };
