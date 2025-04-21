import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { MessageProps } from "../types/types";

self.onmessage = async (event) => {
    const dmMessage: MessageProps = event.data.dmMessage;
    await addData({
        storeName: STORES.DM_MESSAGES,
        data: dmMessage
    })

    self.postMessage("done");
};

export { };
