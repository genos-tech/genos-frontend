import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const dmThreadMessage: MessageProps = event.data.dmThreadMessage;
    await addData({
        storeName: STORES.DM_THREAD_MESSAGES,
        data: dmThreadMessage
    })

    self.postMessage("done");
};

export { };
