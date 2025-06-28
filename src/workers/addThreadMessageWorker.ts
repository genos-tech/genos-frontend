import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const threadMessage: MessageProps = event.data.threadMessage;
    const isDm: boolean = event.data.isDm;

    await addData({
        storeName: isDm ? STORES.DM_THREAD_MESSAGES : STORES.GM_THREAD_MESSAGES,
        data: threadMessage,
    });

    self.postMessage("done");
};

export {};
