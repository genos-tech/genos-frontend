import { STORES } from "../components/indexedDBUtils/conf";
import { addData } from "../components/indexedDBUtils/crud";
import { MessageProps } from "../types";

self.onmessage = async (event) => {
    const dmMessage: MessageProps = event.data.dmMessage;
    await addData({
        storeName: STORES.DM_MESSAGES,
        data: dmMessage
    })

    self.postMessage("done");
};

export { };
