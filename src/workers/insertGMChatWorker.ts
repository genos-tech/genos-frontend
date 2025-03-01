import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { AllChatProps } from "../types";

self.onmessage = async (event) => {
    const gmChat: AllChatProps = event.data.gmChat;
    await addData({
        storeName: STORES.GM_CHATS,
        data: gmChat
    })

    self.postMessage("done");
};

export { };
