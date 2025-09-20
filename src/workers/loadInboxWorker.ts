import { loadInbox } from "../features/chat/services/loadInbox";
import { UserProps } from "../types/admin";
import { InboxItemProps } from "../types/common";
import { STORES } from "../db/conf";
import { clearStore, miniBatchInsert } from "../db/crud";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.INBOX);

    // Load data from backend
    const inboxHistory: InboxItemProps[] = await loadInbox(
        myself.teamId,
        myself.userId,
        accessToken
    );

    // mini batch insert
    for (let i = 0; i < inboxHistory.length; i += BATCH_SIZE) {
        const miniBatch: InboxItemProps[] = inboxHistory.slice(i, i + BATCH_SIZE);
        await miniBatchInsert({
            storeName: STORES.INBOX,
            miniBatch: miniBatch,
        });
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
