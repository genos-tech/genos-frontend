// Inbox-channel handlers. Consolidates the 3 single-purpose inbox workers
// (addInboxItem, loadInbox, popInboxItems).

import { loadInbox } from "../../../features/inbox/services/loadInbox";
import type { InboxItemProps } from "../../../types/common";
import { InboxRepository } from "../../repositories";
import type { InboxRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;
const inboxRepo = new InboxRepository();

export const inboxHandlers: HandlerMap<InboxRequests> = {
    addInboxItem: async ({ inboxItem }) => {
        await inboxRepo.put(inboxItem);
    },

    loadInbox: async ({ myself, accessToken }) => {
        await syncWithCheckpoint({
            key: "inbox",
            fetcher: async (since) => {
                const response = await loadInbox(myself.teamId, myself.userId, accessToken, since);
                if (!response) {
                    throw new Error("Failed to load inbox");
                }
                return {
                    serverTime: response.serverTime,
                    data: response.items,
                    forceFull: response.forceFull,
                };
            },
            applier: async (items, hadCheckpoint) => {
                if (!hadCheckpoint) {
                    await inboxRepo.clear();
                }
                // Split: deletions remove the local row; non-deletions upsert.
                // Strip `isDeleted` before persisting so the stored shape
                // stays equivalent to what addInboxItem/WebSocket writes.
                const toUpsert: InboxItemProps[] = [];
                for (const item of items) {
                    if (item.isDeleted) {
                        await inboxRepo.delete(item.itemId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = item;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await inboxRepo.batchInsert(toUpsert.slice(i, i + BATCH_SIZE));
                }
            },
        });
    },

    popInboxItems: async () => {
        const result = await inboxRepo.getAll();
        const items: InboxItemProps[] = result.success && result.data ? result.data : [];
        return [...items].sort(
            (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
        );
    },
};
