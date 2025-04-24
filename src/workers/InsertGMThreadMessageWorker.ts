import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const gmThreadMessage: MessageProps = event.data.gmThreadMessage;
    await addData({
        storeName: STORES.GM_THREAD_MESSAGES,
        data: gmThreadMessage
    })

    self.postMessage("done");
};

export { };
