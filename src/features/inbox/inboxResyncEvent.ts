/**
 * "Something landed in my inbox that no socket event announced — go look."
 *
 * The inbox has exactly one live path: a `wsType: "inbox"` socket event with
 * `alreadyExist === false` (`websocket-handlers.ts`). That event is a CLIENT
 * RELAY — Django returns the inbox payload to the acting client, which emits
 * it — so it exists only for items one user's request created for another.
 *
 * A reminder has no acting client. The `message_reminder_tick` cron files the
 * Inbox item, and nothing tells any browser: the row is simply there the next
 * time something reads `GET /inbox/`. That is why a fired reminder appeared
 * only after a page reload.
 *
 * Closing it properly would mean giving the cron a way to reach the sockets
 * server, which today has no HTTP ingress and no auth scheme to build one on,
 * and no Redis message queue to publish through. So this is the client-side
 * answer instead: whoever has reason to believe the inbox just changed says
 * so, and `useInboxResync` runs the same delta sync + repaint the wake
 * refresh already uses.
 *
 * Callers with that reason. The first two are complementary rather
 * than redundant — each covers what the other cannot:
 *   * the reminder sweep (`reminderSweep.ts`), which already arms a timer for
 *     shortly after the soonest pending reminder is due. It fires whether or
 *     not a push arrived, which is the whole point: a device whose push
 *     subscription is dead still gets its reminder.
 *   * a push actually arriving (`sw.js` → `pushSubscription.ts`). This one
 *     needs no timer and covers reminders nobody's timer knew about — one set
 *     on another device after this tab loaded.
 *
 * The third is an approved agent write that changes an inbox item on the
 * server (`approve_join_request` / `decline_join_request` close a request).
 * The app's own Approve button updates the row itself and relays through the
 * socket server; a tool runs on the API and has no browser to relay from, so
 * the row is changed behind this one's back. See `agentQA/approvedProjectWrites`.
 *
 * The rest are about a report, which is filed by the API (a cron at 09:00, or
 * "Run now") with no browser to relay it: a successful "Run now"
 * (`schedule-run`), the Inbox's own Sync button (`manual`), and the tab or
 * window regaining focus after a minute or more (`focus`, answered inside
 * `useInboxResync`). The wake refresh (`useWakeRefresh`) covers a long
 * absence, 10 minutes hidden; focus covers the gap below it.
 *
 * Same window-event shape as `selfEchoEvent.ts`, and for the same reason:
 * the senders (a service singleton, a hook, a service-worker message) have no
 * path to the React state that has to change.
 */

export const INBOX_RESYNC_EVENT = "inbox:resync";

/** Why the resync was asked for. Only `"push"` changes the behaviour (see
 *  `deliveredTag`); otherwise it is here to be logged and asserted on.
 *
 *  `"schedule-run"` is a "Run now" that succeeded (`runScheduleAndAnnounce`):
 *  the report was filed by the API with no acting browser, so nothing else
 *  announces it. `"manual"` is the Inbox page's Sync button. `"focus"` is the
 *  tab or window coming back after a while (`useInboxResync`). */
export type InboxResyncReason =
    | "reminder-sweep"
    | "push"
    | "agent-write"
    | "schedule-run"
    | "manual"
    | "focus";

/** What a resync cycle found. `ok: false` covers both a failed sync and "no one
 *  was listening" (signed out, tests); `added` counts rows the device did not
 *  have before the cycle began. */
export interface InboxResyncResult {
    ok: boolean;
    added: number;
}

export interface InboxResyncDetail {
    reason: InboxResyncReason;
    /** The notification `tag` a card has ALREADY been shown for — set when a
     *  service worker relays an arriving push. Whatever that tag identifies
     *  still needs its inbox row synced, but not a second notification: the
     *  page would raise one with the same tag, replacing the worker's richer
     *  card (action buttons, `requireInteraction`) with a plainer one. */
    deliveredTag?: string;
    /** Set by the listener to say it took the request, and will call `done`
     *  once the whole (possibly coalesced) cycle ends. */
    accepted?: boolean;
    done?: (result: InboxResyncResult) => void;
}

const UNHEARD: InboxResyncResult = { ok: false, added: 0 };

/** Ask for an inbox delta sync + repaint. Resolves when the cycle that covers
 *  this request ends; never rejects. A caller that does not care about the
 *  outcome (the sweep, a push) just ignores the promise. No-op outside a
 *  browser (tests), and resolves `ok: false` if no listener is mounted. */
export const requestInboxResync = (
    reason: InboxResyncReason,
    deliveredTag?: string
): Promise<InboxResyncResult> => {
    if (typeof window === "undefined") return Promise.resolve(UNHEARD);
    return new Promise((resolve) => {
        const detail: InboxResyncDetail = { reason, deliveredTag, done: resolve };
        // Dispatch is synchronous: by the time it returns, a mounted listener
        // has set `accepted`. Without one, nothing will ever call `done`.
        window.dispatchEvent(new CustomEvent<InboxResyncDetail>(INBOX_RESYNC_EVENT, { detail }));
        if (!detail.accepted) resolve(UNHEARD);
    });
};

/**
 * When the inbox was last synced (or a sync last started). Read by the focus
 * resync so a tab that just ran the wake refresh, or a push-driven sync, is
 * not synced again the moment its window is clicked.
 *
 * Module scope is right here, unlike `changeRefresher`'s tokens: there is one
 * inbox store per tab, and every writer syncs the same one. Starts at page
 * load, because the boot refresh runs then.
 */
let inboxSyncedAt = Date.now();

/** Note that a sync is starting now. */
export const markInboxSyncing = (): void => {
    inboxSyncedAt = Date.now();
};

/** Milliseconds since the last sync started. */
export const inboxSyncAgeMs = (): number => Date.now() - inboxSyncedAt;

/** Re-sync on focus only when the last sync is at least this old. */
export const INBOX_FOCUS_RESYNC_MS = 60_000;
