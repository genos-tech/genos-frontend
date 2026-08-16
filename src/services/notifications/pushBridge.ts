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
//     correctly-timed notice that one exists. It is also where the SURFACE is
//     chosen for a reminder: when the worker attaches a reply port it is
//     offering to skip its OS card if this tab will toast instead, which is
//     the rule every other category already gets from the server's presence
//     gate. Whichever side ends up showing it, the other stays quiet.
//
//   * `push-subscription-changed` — the browser retired the subscription and
//     the worker re-made it. The worker cannot tell the server the new
//     endpoint (that needs the user's token, which lives here), so the page
//     re-registers. Without this, a browser-side rotation left the device
//     silently unsubscribed until its next full reload, which for a laptop
//     tab left open for days is exactly as long as the silence lasted.

import { requestInboxResync } from "../../features/inbox/inboxResyncEvent";
import { isPageHidden } from "./notificationManager";
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

            // The worker hands us a port only when it is asking whether this
            // tab will announce the push itself — i.e. when it is willing to
            // skip its OS card. Saying yes is what gives a reminder the same
            // in-app toast every other category gets on a visible tab, instead
            // of an OS card over the top of one.
            //
            // NO port means a worker that predates this handshake (it claims
            // pages older than itself, so page and worker can differ by a
            // deploy). That worker has already shown its card unconditionally,
            // so the tag must be forwarded to stop a second, plainer notice
            // replacing it.
            const reply = event.ports?.[0];
            const announceHere = !!reply && isReminderTag(tag) && !isPageHidden();
            reply?.postMessage({ handled: announceHere });

            // Only reminders, not every push. Every OTHER push is about
            // something a socket event already delivered live, so resyncing
            // the inbox for it would add a request per backgrounded DM and
            // change nothing. The tag prefix is what says which this is.
            //
            // The tag doubles as "a card exists for this, don't raise
            // another", so it is withheld exactly when we just promised to be
            // the one who announces. Decided here rather than re-read at
            // resync time: the answer the worker acted on is this one, and a
            // tab that goes hidden in between must not retract it.
            if (isReminderTag(tag)) requestInboxResync("push", announceHere ? undefined : tag);
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
