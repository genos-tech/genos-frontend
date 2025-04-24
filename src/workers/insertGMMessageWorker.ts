import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const gmMessage: MessageProps = event.data.gmMessage;
    await addData({
        storeName: STORES.GM_MESSAGES,
        data: gmMessage
    })

    self.postMessage("done");
};

export { };
