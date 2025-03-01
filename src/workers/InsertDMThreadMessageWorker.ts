import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { MessageProps } from "../types";

self.onmessage = async (event) => {
    const dmThreadMessage: MessageProps = event.data.dmThreadMessage;
    await addData({
        storeName: STORES.DM_THREAD_MESSAGES,
        data: dmThreadMessage
    })

    self.postMessage("done");
};

export { };
