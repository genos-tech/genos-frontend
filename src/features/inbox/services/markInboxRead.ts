// Mark an Inbox item read on the server, then in the stored rows (MIP-1292).
//
//   PUT /inbox/   { team_id, item_id, is_read: true }   receiver-only (genos-api)
//
// Nothing else in the app sends this for an item the member only LOOKED at: a request that is
// answered flips its own `isRead` through the sockets service, and `InboxBubble` writes the
// answered card back to IndexedDB. So this is the one HTTP "I read it" call. The body is exactly
// what genos-api's `test_mark_read_alone_still_works` pins; any other key is a forged-field 400.
//
// The local patch goes through the inbox worker and flips ONLY `isRead` on the stored row. A
// whole-row `addInboxItem({ ...inboxItem, isRead: true })` from a card would write back the
// card's props from when it rendered, undoing anything patched since (`patchInboxAiSource`
// rewrites `aiSource.enabled` on stored rows without touching a card's props).
//
// Failure is silent and reported as `false`: the caller retries on the next view. No toast,
// because the member did nothing that could have failed.

import { inboxChannel } from "../../../db/workers/channels";
import { authApi } from "../../../services/api";
import type { InboxItemProps } from "../../../types/common";
import { isActivityItemType } from "../utils/inboxItemTypes";

export const markInboxRead = async (
    accessToken: string | null,
    teamId: string,
    itemId: number
): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.put(
            "/inbox/",
            { team_id: teamId, item_id: itemId, is_read: true },
            {
                suppressErrorToast: true,
            }
        );
    } catch {
        return false;
    }
    // The server has it. A failed local patch heals itself: the PUT bumped `ts_updated_at`, so
    // the next incremental sync brings the row back with `isRead: true`.
    try {
        await inboxChannel.request("markInboxItemsRead", { itemIds: [itemId] });
    } catch {
        /* see above */
    }
    return true;
};

// ---- the member's own read/unread choices (MIP-1627) ------------------------------------------
//
// Unlike the dwell above, these answer a click, so a failure is the caller's to show: they return
// `false` / `{ ok: false }` and write nothing locally, which leaves the card as the server has it.

/** Mark one item unread: `PUT /inbox/ { is_read: false }`, the same receiver-only call, then the
 *  stored row. */
export const markInboxUnread = async (
    accessToken: string | null,
    teamId: string,
    itemId: number
): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.put(
            "/inbox/",
            { team_id: teamId, item_id: itemId, is_read: false },
            { suppressErrorToast: true }
        );
    } catch {
        return false;
    }
    try {
        await inboxChannel.request("markInboxItemsUnread", { itemIds: [itemId] });
    } catch {
        /* healed by the next incremental sync, as above */
    }
    return true;
};

export type MarkAllResult = {
    ok: boolean;
    /** How many rows the server changed (what the toast says). */
    updated: number;
    /** The ids patched locally, so the caller can release their holds. */
    itemIds: number[];
};

/**
 * "Mark all as read" on the Activities tab: one `POST /inbox/mark-read/`.
 *
 * `up_to_item_id` is the newest activity this device holds, so an item that arrived after the
 * list was drawn (and was never on screen) stays unread. Only the Activities half is ever sent:
 * a request is something somebody is waiting on, and "read" must not look like "dealt with".
 */
export const markAllActivitiesRead = async (
    accessToken: string | null,
    teamId: string,
    items: InboxItemProps[]
): Promise<MarkAllResult> => {
    const none: MarkAllResult = { ok: false, updated: 0, itemIds: [] };
    const api = authApi(accessToken);
    if (!api) return none;
    const activities = items.filter((item) => isActivityItemType(item.itemType));
    const upTo = activities.reduce((max, item) => Math.max(max, item.itemId), 0);
    const itemIds = activities.filter((item) => !item.isRead).map((item) => item.itemId);
    if (itemIds.length === 0) return { ok: true, updated: 0, itemIds: [] };
    let updated = 0;
    try {
        const res = await api.post(
            "/inbox/mark-read/",
            { team_id: teamId, scope: "activities", up_to_item_id: upTo },
            { suppressErrorToast: true }
        );
        updated = Number(res?.data?.updated ?? itemIds.length);
    } catch {
        return none;
    }
    try {
        await inboxChannel.request("markInboxItemsRead", { itemIds });
    } catch {
        /* the server has it; the next incremental sync brings the rows back read */
    }
    return { ok: true, updated, itemIds };
};
