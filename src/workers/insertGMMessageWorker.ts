import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { MessageProps } from "../types";

self.onmessage = async (event) => {
    const gmMessage: MessageProps = event.data.gmMessage;
    await addData({
        storeName: STORES.GM_MESSAGES,
        data: gmMessage
    })

    self.postMessage("done");
};

export { };
