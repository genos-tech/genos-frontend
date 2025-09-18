import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { AllChatProps } from "../types/chat";

self.onmessage = async (event) => {
    const dmChats: AllChatProps[] = await messageIdWithChatId({
        storeName: STORES.DM_CHATS,
    });

    const gmChats: AllChatProps[] = await messageIdWithChatId({
        storeName: STORES.GM_CHATS,
    });

    const pmChats: AllChatProps[] = await messageIdWithChatId({
        storeName: STORES.PM_CHATS,
    });

    // Sort messages by TSLastMessage in desc
    const sortedAllChats = [...dmChats, ...gmChats, ...pmChats].sort((a, b) => {
        return new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();
    });

    self.postMessage(sortedAllChats);

    self.close(); // Terminates itself
};

export {};
