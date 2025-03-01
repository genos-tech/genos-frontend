import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { MessageProps } from "../types";

self.onmessage = async (event) => {
    const gmThreadMessage: MessageProps = event.data.gmThreadMessage;
    await addData({
        storeName: STORES.GM_THREAD_MESSAGES,
        data: gmThreadMessage
    })

    self.postMessage("done");
};

export { };
