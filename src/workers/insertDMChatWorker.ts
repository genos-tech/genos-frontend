import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { AllChatProps } from "../types";

self.onmessage = async (event) => {
    const dmChat: AllChatProps = event.data.dmChat;
    await addData({
        storeName: STORES.DM_CHATS,
        data: dmChat
    })

    self.postMessage("done");
};

export { };
