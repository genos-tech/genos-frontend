import { STORES } from "../components/indexedDBUtils/conf";
import { getAllDataWithIndex } from "../components/indexedDBUtils/crud";
import { AllChatProps } from '../types';

self.onmessage = async (event) => {
    const dmChats: AllChatProps[] = await getAllDataWithIndex({
        storeName: STORES.DM_CHATS
    })

    const gmChats: AllChatProps[] = await getAllDataWithIndex({
        storeName: STORES.GM_CHATS
    })

    self.postMessage([...dmChats, ...gmChats]);
};

export { };
