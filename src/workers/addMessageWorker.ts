import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_CHATS,
    2: STORES.GM_CHATS,
    3: STORES.PM_CHATS,
};

self.onmessage = async (event) => {
    const message: MessageProps = event.data.message;
    const chatType: number = event.data.chatType;

    await addData({
        storeName: storeNameLookup[chatType],
        data: message,
    });

    self.postMessage("done");
};

export {};
