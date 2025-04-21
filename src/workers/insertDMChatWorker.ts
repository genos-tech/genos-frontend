import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { AllChatProps } from "../types/types";

self.onmessage = async (event) => {
    const dmChat: AllChatProps = event.data.dmChat;
    await addData({
        storeName: STORES.DM_CHATS,
        data: dmChat
    })

    self.postMessage("done");
};

export { };
