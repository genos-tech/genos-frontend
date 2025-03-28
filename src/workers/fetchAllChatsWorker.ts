import { STORES } from "../components/indexedDBUtils/conf";
import { messageIdWithChatId } from "../components/indexedDBUtils/crud";
import { AllChatProps } from '../types';

self.onmessage = async (event) => {
    const dmChats: AllChatProps[] = await messageIdWithChatId({
        storeName: STORES.DM_CHATS
    })

    const gmChats: AllChatProps[] = await messageIdWithChatId({
        storeName: STORES.GM_CHATS
    })

    self.postMessage([...dmChats, ...gmChats]);
};

export { };
