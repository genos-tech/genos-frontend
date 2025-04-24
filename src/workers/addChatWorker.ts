import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { AllChatProps } from "../types/types";

self.onmessage = async (event) => {
    const chat: AllChatProps = event.data.chat;
    const isDm: boolean = event.data.isDm;

    await addData({
        storeName: isDm ? STORES.DM_CHATS : STORES.GM_CHATS,
        data: chat
    })

    self.postMessage("done");
};

export { };
