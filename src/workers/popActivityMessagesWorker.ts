import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { ActivityMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const activityMessages: ActivityMessageProps[] = await messageIdWithChatId({
        storeName: STORES.ACTIVITY_MESSAGES,
    });

    // Sort messages by tsSent in desc
    const sortedActivityMessages = [...activityMessages].sort((a, b) => {
        return new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime();
    });

    self.postMessage(sortedActivityMessages);
};

export {};
