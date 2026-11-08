/**
 * MIP-1292: the worker patch that follows a successful "mark read" PUT flips `isRead` on the
 * stored row and NOTHING else. It must read the stored row, not take one from the card: a card
 * holds the item as it was when it rendered, and `patchInboxAiSource` rewrites
 * `aiSource.enabled` on stored rows without touching any card's props.
 */
import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { InboxRepository } from "../../db/repositories";
import { inboxHandlers } from "../../db/workers/handlers/inbox.handlers";
import type { InboxItemProps } from "../../types/common";

vi.spyOn(console, "warn").mockImplementation(() => {});

const row = (itemId: number, over: Partial<InboxItemProps> = {}) =>
    ({
        itemId,
        itemBody: [],
        itemType: 10,
        isRead: false,
        requestStatus: "",
        tsSent: "2026-11-09T00:00:00Z",
        ...over,
    }) as InboxItemProps;

const stored = async () => {
    const result = await new InboxRepository().getAll();
    return new Map((result.data ?? []).map((r) => [r.itemId, r]));
};

describe("markInboxItemsRead", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("flips isRead on the named rows only, keeping every other field as stored", async () => {
        const repo = new InboxRepository();
        await repo.batchInsert([
            row(1, {
                aiSource: { kind: "schedule", schedule_id: "s1", enabled: false } as never,
            }),
            row(2),
            row(3, { itemType: 1, requestStatus: "pending" }),
        ]);
        await inboxHandlers.markInboxItemsRead({ itemIds: [1, 3] });
        const rows = await stored();
        expect(rows.get(1)?.isRead).toBe(true);
        // Patched earlier on the stored row (the card still holds enabled: true): kept.
        expect(rows.get(1)?.aiSource).toMatchObject({ enabled: false });
        expect(rows.get(2)?.isRead).toBe(false);
        expect(rows.get(3)).toMatchObject({ isRead: true, requestStatus: "pending" });
    });

    it("does nothing for an id that is no longer stored", async () => {
        await new InboxRepository().batchInsert([row(1)]);
        await inboxHandlers.markInboxItemsRead({ itemIds: [99] });
        expect((await stored()).get(1)?.isRead).toBe(false);
        expect((await stored()).has(99)).toBe(false);
    });
});
