import { useCallback, useEffect, useRef } from "react";

import { inboxChannel } from "../../db/workers/channels";
import {
    INBOX_FOCUS_RESYNC_MS,
    INBOX_RESYNC_EVENT,
    InboxResyncDetail,
    InboxResyncResult,
    inboxSyncAgeMs,
    markInboxSyncing,
    requestInboxResync,
} from "../../features/inbox/inboxResyncEvent";
import { popInboxItems } from "../../features/inbox/services/popInboxItems";
import type { NotificationManager } from "../../services/notifications/notificationManager";
import {
    isReminderItem,
    notifyReminderDue,
    reminderIntentId,
} from "../../services/notifications/reminderNotice";
import type { UserProps } from "../../types/admin";
import type { InboxItemProps } from "../../types/common";

/**
 * How stale a reminder may be and still be worth a popup.
 *
 * Only the NOTIFICATION is gated — the inbox always repaints with whatever
 * the sync found, however old. Two reasons for a bound at all:
 *
 *   * A device with an empty IndexedDB (first sign-in, cleared storage) has
 *     its first `loadInbox` pull the whole recent inbox at once. Every row is
 *     "new" to the diff below, so without this a fresh laptop would fire a
 *     notification per historical reminder the moment a sweep ran.
 *   * A reminder is a statement about *now*. One that came due last night
 *     belongs in the inbox list, not in a popup this morning.
 *
 * Half an hour rather than something tight, because the delivery chain has
 * real slack in it: the cron drains on a five-minutely tick (Railway's floor
 * — see `CronCommand.drain_passes`), the sweep timer waits out a 90s grace,
 * and a background tab's timers are throttled. All of that is still plainly
 * "just now" to a person; a night's sleep is not.
 */
const NOTIFY_WITHIN_MS = 30 * 60 * 1000;

/** When the reminder was due, from the optionals the server filed. Falls
 *  back to when the row was created — the two are within a tick of each
 *  other by construction, since the cron files the row as it fires. */
const dueAt = (item: InboxItemProps): number => {
    const remindAt = item.itemOptionals?.remind_at;
    const parsed = Date.parse(typeof remindAt === "string" ? remindAt : (item.tsSent ?? ""));
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Answer an inbox-resync request: delta-sync the inbox, repaint it, and
 * announce any reminder that just landed.
 *
 * This is the live path a cron-filed inbox item has never had. The socket
 * `wsType: "inbox"` event is relayed by the client whose request created the
 * item (`websocket-handlers.ts`), and a cron has no such client — so a fired
 * reminder used to appear only on the next page load. See
 * `inboxResyncEvent.ts` for who asks and why there are two of them.
 *
 * Deliberately mounted ONCE, near `useNotifications` in `App.tsx`, rather
 * than inside `useInboxManagement`: the sync needs `myself`/`accessToken`
 * and the notice needs the manager, none of which that hook has, and a
 * per-route mount would leave the app deaf to a sweep on most screens.
 */
export const useInboxResync = (
    myself: UserProps,
    accessToken: string | null,
    manager: NotificationManager | null | undefined,
    setInboxItems: (items: InboxItemProps[]) => void
): void => {
    // Every input goes through a ref so the listener below is installed once
    // and never torn down. Re-subscribing whenever the token or the manager
    // identity changed would open a window with no listener in it, and a
    // sweep that fires in that window is simply lost — each reminder's timer
    // fires exactly once.
    const latest = useRef({ myself, accessToken, manager, setInboxItems });
    latest.current = { myself, accessToken, manager, setInboxItems };

    // A run in flight, and whether another was asked for while it ran.
    // Overlap is the expected case, not an edge one: a push and the sweep
    // timer for the same reminder land within seconds of each other. The
    // second flag rather than just dropping the extra, because the two
    // triggers can be about DIFFERENT reminders — the sync already in flight
    // may have read the server before the second one's row existed.
    const running = useRef(false);
    const requeued = useRef(false);

    // Tags the service worker has already shown a card for, accumulated
    // across a coalesced cycle and cleared when it ends. Rows they identify
    // still get synced and repainted; they just don't get a second card.
    const delivered = useRef<Set<string>>(new Set());

    // What the cycle in flight owes the callers that asked for it (the Sync
    // button, "Run now"): who to tell, which rows were new across every pass,
    // and whether any pass failed. All reset when the cycle ends.
    const waiters = useRef<Array<(result: InboxResyncResult) => void>>([]);
    const addedIds = useRef<Set<number>>(new Set());
    const failed = useRef(false);

    const resync = useCallback(async (): Promise<void> => {
        const { myself, accessToken, manager, setInboxItems } = latest.current;
        if (!accessToken || !myself?.userId) {
            failed.current = true;
            return;
        }
        markInboxSyncing();

        // Snapshot from IndexedDB, NOT from React state: the state may not
        // have had its first read yet (`useInboxManagement` hydrates in an
        // effect), and treating an empty state as "nothing was here before"
        // would make every existing row look new.
        const previous = await popInboxItems();
        const before = new Set((previous ?? []).map((item) => item.itemId));

        // The same checkpointed delta sync the wake refresh runs
        // (`refreshAllData`), so this costs a `?since=` request, not a
        // full inbox reload.
        await inboxChannel.request("loadInbox", { myself, accessToken });

        const after = await popInboxItems();
        if (!after) {
            failed.current = true;
            return;
        }
        setInboxItems(after);

        const now = Date.now();
        for (const item of after) {
            if (before.has(item.itemId)) continue;
            addedIds.current.add(item.itemId);
            if (!isReminderItem(item)) continue;
            if (now - dueAt(item) > NOTIFY_WITHIN_MS) continue;
            // The ONLY reason to stay quiet is a card this device has
            // demonstrably already shown. Notably NOT "push looks configured"
            // — a subscription the push service has stopped honouring is
            // indistinguishable from a working one here, and assuming it works
            // is exactly how a laptop ended up silent while the phone rang.
            if (delivered.current.has(reminderIntentId(item) ?? "")) continue;
            notifyReminderDue(manager, item);
        }
    }, []);

    const request = useCallback(async (): Promise<void> => {
        if (running.current) {
            requeued.current = true;
            return;
        }
        running.current = true;
        try {
            do {
                requeued.current = false;
                await resync();
            } while (requeued.current);
        } catch (err) {
            // Best-effort by design. A failed resync costs the user a live
            // reminder, not correctness — the row is on the server and the
            // next sync of any kind (wake refresh, reload) will show it.
            console.warn("[inbox] resync failed", err);
            failed.current = true;
        } finally {
            running.current = false;
            requeued.current = false;
            delivered.current.clear();
            const result = { ok: !failed.current, added: addedIds.current.size };
            const asked = waiters.current;
            waiters.current = [];
            addedIds.current = new Set();
            failed.current = false;
            for (const done of asked) done(result);
        }
    }, [resync]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const onRequest = (event: Event) => {
            const detail = (event as CustomEvent<InboxResyncDetail>).detail;
            if (!detail) return;
            if (detail.deliveredTag) delivered.current.add(detail.deliveredTag);
            // Taking the request is what tells `requestInboxResync` someone is
            // listening; `done` is called when the cycle ends, however many
            // requests it absorbed.
            detail.accepted = true;
            if (detail.done) waiters.current.push(detail.done);
            void request();
        };
        window.addEventListener(INBOX_RESYNC_EVENT, onRequest);
        return () => window.removeEventListener(INBOX_RESYNC_EVENT, onRequest);
    }, [request]);

    // The tab or window coming back. Not a polling timer: it runs only on the
    // event, and only when the last sync is at least a minute old, so a
    // Cmd-Tab back and forth costs nothing. `useWakeRefresh` already covers a
    // long absence (10 minutes hidden: it runs `refreshAllData`, which syncs
    // the inbox and stamps the clock), but it listens to `visibilitychange`
    // only and has that threshold; a window that merely lost focus, or a tab
    // hidden for three minutes, fell in the gap. The check waits one task so
    // a wake refresh started by the same event has stamped the clock first,
    // whichever listener ran first, and one return = one sync (`focus` and
    // `visibilitychange` usually arrive together).
    useEffect(() => {
        if (typeof window === "undefined") return;
        let timer: number | undefined;
        const onBack = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                if (document.visibilityState !== "visible") return;
                if (inboxSyncAgeMs() < INBOX_FOCUS_RESYNC_MS) return;
                void requestInboxResync("focus");
            }, 0);
        };
        window.addEventListener("focus", onBack);
        document.addEventListener("visibilitychange", onBack);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("focus", onBack);
            document.removeEventListener("visibilitychange", onBack);
        };
    }, []);
};
