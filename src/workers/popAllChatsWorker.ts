import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { AllChatProps } from '../types/chat';

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
