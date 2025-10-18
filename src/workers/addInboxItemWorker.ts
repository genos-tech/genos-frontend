import { InboxRepository } from "../db/repositories";
import { InboxItemProps } from "../types/common";

self.onmessage = async (event) => {
    const inboxItem: InboxItemProps = event.data.inboxItem;

    const inboxRepo = new InboxRepository();
    await inboxRepo.put(inboxItem);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
