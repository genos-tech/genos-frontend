/**
 * Bridges the server's read-cursor → activity auto-clear into the
 * sidebar. When a user's read cursor sweeps past a message, the backend
 * (`read_cursor_views`) also marks that message's unread sidebar
 * activities read and echoes their ids as `readActivityIds` on the
 * `read.advanced` broadcast. This module lands that clear into the
 * activity IDB store, then dispatches `v3:activities:read` on `window`
 * so `useChatManagement` re-derives the sidebar list + badge — the same
 * bus pattern `handleV3Activity` uses for `activity.created`.
 *
 * Why IDB-first (flip the store, then re-derive) rather than an
 * in-memory optimistic edit: this fires from the socket router, which
 * has no React context, so it can't touch `useCM.activityMessages`
 * directly. Persisting the flip is also mandatory on its own — the
 * sidebar re-pops from IDB on every mount / chat switch, so an
 * un-persisted flip would resurrect the unread state on the next pop.
 * `popActivityMessages` returns read AND unread rows, so writing the
 * `isRead: true` flip to IDB and re-deriving is sufficient.
 *
 * Broadcast to the user's OWN room, so this runs on every tab — the one
 * that advanced the cursor (its `markRead` ack is swallowed) and every
 * other — keeping the sidebar in lockstep across tabs for free.
 */

import { ActivityService } from "../../../db/services";
import type { ActivityMessageProps } from "../../../types/chat";

/** Event name dispatched on `window` after read-cursor-cleared activities
 *  have been flipped to `isRead: true` in IDB. `useChatManagement`
 *  listens and calls `funcSetActivityMessages()` so the sidebar list and
 *  unread badge re-derive without waiting for a mount / chat switch.
 *  Mirrors `V3_ACTIVITY_CREATED_EVENT`; a global bus is used because the
 *  socket router has no React context. `detail.activityIds` carries the
 *  cleared ids for any listener that wants them — the useChatManagement
 *  listener ignores it and always re-derives from IDB. */
export const V3_ACTIVITIES_READ_EVENT = "v3:activities:read";

/**
 * Flip the given activity ids to `isRead: true` in IDB and notify the
 * sidebar. No-ops on an empty id list (older backends omit the field) and
 * on ids not present in the local store (another team's rows, or entries
 * that aged out of the 30-day window). Failures are non-fatal — the next
 * `loadActivityHistory` reconciles from the server, which is already the
 * source of truth for `is_read`.
 */
export async function handleV3ActivitiesRead(activityIds: string[]): Promise<void> {
    if (!activityIds || activityIds.length === 0) return;
    try {
        const service = new ActivityService();
        const all = await service.getAllActivityMessages();
        const clearing = new Set(activityIds);
        const affected: ActivityMessageProps[] = [];
        for (const row of all) {
            if (clearing.has(row.activityId) && row.isRead === false) {
                affected.push({ ...row, isRead: true });
            }
        }
        if (affected.length > 0) {
            await service.batchInsertActivityMessages(affected);
        }
        // Notify even when nothing local matched: harmless (the listener
        // just re-derives the same state) and it keeps the bridge's
        // "cursor advanced ⇒ sidebar refreshed" contract unconditional.
        window.dispatchEvent(
            new CustomEvent(V3_ACTIVITIES_READ_EVENT, { detail: { activityIds } })
        );
    } catch (e) {
        console.error("[handleV3ActivitiesRead] failed", e);
    }
}
