import { InboxRepository } from "../db/repositories";
import { InboxItemProps } from "../types/common";

self.onmessage = async (event) => {
    const inboxRepository = new InboxRepository();
    const result = await inboxRepository.getAll();
    const inboxItems: InboxItemProps[] = result.success && result.data ? result.data : [];

    // Sort messages by tsSent
    const sortedInboxItems = inboxItems.sort((a, b) => {
        return new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime();
    });

    self.postMessage(sortedInboxItems);

    self.close(); // Terminates itself
};

export {};
