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
 * Two callers have that reason, and they are complementary rather than
 * redundant — each covers what the other cannot:
 *   * the reminder sweep (`reminderSweep.ts`), which already arms a timer for
 *     shortly after the soonest pending reminder is due. It fires whether or
 *     not a push arrived, which is the whole point: a device whose push
 *     subscription is dead still gets its reminder.
 *   * a push actually arriving (`sw.js` → `pushSubscription.ts`). This one
 *     needs no timer and covers reminders nobody's timer knew about — one set
 *     on another device after this tab loaded.
 *
 * Same window-event shape as `selfEchoEvent.ts`, and for the same reason:
 * the senders (a service singleton, a hook, a service-worker message) have no
 * path to the React state that has to change.
 */

export const INBOX_RESYNC_EVENT = "inbox:resync";

/** Why the resync was asked for. Only `"push"` changes the behaviour (see
 *  `deliveredTag`); otherwise it is here to be logged and asserted on. */
export type InboxResyncReason = "reminder-sweep" | "push";

export interface InboxResyncDetail {
    reason: InboxResyncReason;
    /** The notification `tag` a card has ALREADY been shown for — set when a
     *  service worker relays an arriving push. Whatever that tag identifies
     *  still needs its inbox row synced, but not a second notification: the
     *  page would raise one with the same tag, replacing the worker's richer
     *  card (action buttons, `requireInteraction`) with a plainer one. */
    deliveredTag?: string;
}

/** Ask for an inbox delta sync + repaint. No-op outside a browser (tests). */
export const requestInboxResync = (reason: InboxResyncReason, deliveredTag?: string): void => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<InboxResyncDetail>(INBOX_RESYNC_EVENT, {
            detail: { reason, deliveredTag },
        })
    );
};
