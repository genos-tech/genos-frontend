// Inbox-channel handlers. Consolidates the 3 single-purpose inbox workers
// (addInboxItem, loadInbox, popInboxItems).

import { loadInbox } from "../../../features/chat/services/loadInbox";
import type { InboxItemProps } from "../../../types/common";
import { InboxRepository } from "../../repositories";
import type { InboxRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

const BATCH_SIZE = 1000;
const inboxRepo = new InboxRepository();

export const inboxHandlers: HandlerMap<InboxRequests> = {
    addInboxItem: async ({ inboxItem }) => {
        await inboxRepo.put(inboxItem);
    },

    loadInbox: async ({ myself, accessToken }) => {
        await inboxRepo.clear();
        const history: InboxItemProps[] = await loadInbox(
            myself.teamId,
            myself.userId,
            accessToken
        );
        for (let i = 0; i < history.length; i += BATCH_SIZE) {
            await inboxRepo.batchInsert(history.slice(i, i + BATCH_SIZE));
        }
    },

    popInboxItems: async () => {
        const result = await inboxRepo.getAll();
        const items: InboxItemProps[] = result.success && result.data ? result.data : [];
        return [...items].sort(
            (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
        );
    },
};
