import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { AllChatProps } from "../types/types";

self.onmessage = async (event) => {
    const gmChat: AllChatProps = event.data.gmChat;
    await addData({
        storeName: STORES.GM_CHATS,
        data: gmChat
    })

    self.postMessage("done");
};

export { };
