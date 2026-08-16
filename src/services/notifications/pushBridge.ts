// Page-side handling of the two messages the service worker sends about the
// push channel itself. (`notification-click` is a third, handled by
// `initPushClickNavigation` — it is about navigation, not about push state.)
//
// Both exist because the worker knows something the page cannot see, and both
// address the same reported failure: reminders arriving on a phone and never
// on a laptop.
//
//   * `push-received` — a push landed. The page uses it as a data signal:
//     an inbox row filed by a backend cron has no socket event to announce it
//     (see `features/inbox/inboxResyncEvent`), and the push is the only
//     correctly-timed notice that one exists. The worker has already shown
//     the OS card, so the tag is forwarded to keep the page from raising a
//     second, plainer one for the same thing.
//
//   * `push-subscription-changed` — the browser retired the subscription and
//     the worker re-made it. The worker cannot tell the server the new
//     endpoint (that needs the user's token, which lives here), so the page
//     re-registers. Without this, a browser-side rotation left the device
//     silently unsubscribed until its next full reload, which for a laptop
//     tab left open for days is exactly as long as the silence lasted.

import { requestInboxResync } from "../../features/inbox/inboxResyncEvent";
import { ensurePushSubscription } from "./pushSubscription";
import { isReminderTag } from "./reminderNotice";

let bridgeInstalled = false;

/**
 * Install the bridge. Safe to call repeatedly — only the first call binds.
 *
 * `getAccessToken` is a getter rather than a value because the listener
 * outlives any single token: it is installed once, deliberately, so there is
 * no window in which a push arrives with nothing listening.
 */
export const initPushBridge = (getAccessToken: () => string | null | undefined): void => {
    if (bridgeInstalled) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    bridgeInstalled = true;

    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data.type !== "string") return;

        if (data.type === "push-received") {
            const tag = typeof data.tag === "string" ? data.tag : "";
            // Only reminders, not every push. Every OTHER push is about
            // something a socket event already delivered live, so resyncing
            // the inbox for it would add a request per backgrounded DM and
            // change nothing. The tag prefix is what says which this is.
            if (isReminderTag(tag)) requestInboxResync("push", tag);
            return;
        }

        if (data.type === "push-subscription-changed") {
            // Unconditional re-register: `ensurePushSubscription` reads the
            // live subscription itself, so it is correct whether or not the
            // worker managed to re-subscribe, and it no-ops when push is
            // unsupported or permission was revoked.
            void ensurePushSubscription(getAccessToken());
        }
    });
};

/** Test seam: forget that the bridge was installed. Production code has no
 *  reason to call this — the listener is meant to live for the page's life. */
export const resetPushBridgeForTests = (): void => {
    bridgeInstalled = false;
};
