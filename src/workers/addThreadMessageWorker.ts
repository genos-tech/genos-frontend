import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

const storeNameLookup: { [key: number]: string } = {
    1: STORES.DM_THREAD_MESSAGES,
    2: STORES.GM_THREAD_MESSAGES,
    3: STORES.PM_THREAD_MESSAGES,
};

self.onmessage = async (event) => {
    const threadMessage: MessageProps = event.data.threadMessage;
    const chatType: number = event.data.chatType;

    await addData({
        storeName: storeNameLookup[chatType],
        data: threadMessage,
    });

    self.postMessage("done");
};

export {};
