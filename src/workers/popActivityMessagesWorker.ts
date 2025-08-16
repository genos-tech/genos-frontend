import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { ActivityMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const activityMessages: ActivityMessageProps[] = await messageIdWithChatId({
        storeName: STORES.ACTIVITY_MESSAGES,
    });

    self.postMessage(activityMessages);
};

export {};
