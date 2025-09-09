import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { InboxItemProps } from "../types/common";

self.onmessage = async (event) => {
    const inboxItems: InboxItemProps[] = await messageIdWithChatId({
        storeName: STORES.INBOX,
    });

    // Sort messages by tsSent
    const sortedInboxItems = inboxItems.sort((a, b) => {
        return new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime();
    });

    self.postMessage(sortedInboxItems);
};

export {};
