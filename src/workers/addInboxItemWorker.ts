import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { InboxItemProps } from "../types/common";

self.onmessage = async (event) => {
    const inboxItem: InboxItemProps = event.data.inboxItem;

    await addData({
        storeName: STORES.INBOX,
        data: inboxItem,
    });

    self.postMessage("done");
};

export {};
