import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: MessageProps = event.data.message;
    const isDm: boolean = event.data.isDm;
    const chatType: number = event.data.chatType;

    await addData({
        storeName: isDm ? STORES.DM_MESSAGES : STORES.GM_MESSAGES,
        data: message,
    });

    self.postMessage("done");
};

export {};
