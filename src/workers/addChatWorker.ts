import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { AllChatProps } from "../types/chat";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_CHATS,
    2: STORES.GM_CHATS,
    3: STORES.PM_CHATS,
};

self.onmessage = async (event) => {
    const chat: AllChatProps = event.data.chat;
    const chatType: number = event.data.chatType;

    await addData({
        storeName: storeNameLookup[chatType],
        data: chat,
    });

    self.postMessage("done");
};

export {};
