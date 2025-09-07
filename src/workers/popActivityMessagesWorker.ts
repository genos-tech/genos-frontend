import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { UserProps } from "../types/admin";
import { ActivityMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;

    const activityMessages: ActivityMessageProps[] = await messageIdWithChatId({
        storeName: STORES.ACTIVITY_MESSAGES,
    });

    // Filter and then sort messages by tsSent in desc
    const sortedActivityMessages = [...activityMessages]
        .filter((msg) => !(msg.activityType === 2 && myself.userId !== msg.sender.userId))
        .sort((a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime());

    self.postMessage(sortedActivityMessages);
};

export {};
