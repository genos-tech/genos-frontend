import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { FlaggedMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: FlaggedMessageProps = event.data.message;

    await addData({
        storeName: STORES.FLAGGED_MESSAGES,
        data: message,
    });

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
