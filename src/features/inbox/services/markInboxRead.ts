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
