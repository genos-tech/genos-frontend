import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { ActivityMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const activityMessage: ActivityMessageProps = event.data.activityMessage;

    await addData({
        storeName: STORES.ACTIVITY_MESSAGES,
        data: activityMessage,
    });

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
