// The page's end of the two messages `public/sw.js` sends about the push
// channel. The worker half is pinned in `ServiceWorkerCaching.test.ts`; these
// are the message shapes this side matches on, and the shapes are the only
// thing holding the two halves together — they're joined by a string, not by
// a type.
//
// Both messages were added for one reported failure: reminders arriving on a
// phone and never on a laptop.
//
//   * `push-received` is used as a DATA signal. A reminder is filed by a cron
//     with no client to relay a socket event, so the push is the only
//     correctly-timed notice that the inbox row exists.
//   * `push-subscription-changed` repairs a subscription the browser retired.
//     The worker can re-make it but can't tell the server (that needs the
//     user's token), so the page re-registers.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { INBOX_RESYNC_EVENT, InboxResyncDetail } from "../features/inbox/inboxResyncEvent";
import { initPushBridge, resetPushBridgeForTests } from "../services/notifications/pushBridge";
import { ensurePushSubscription } from "../services/notifications/pushSubscription";

// Mocked wholesale: the real one reaches for a service worker registration and
// a VAPID key. What matters here is only whether the bridge calls it, and with
// which token.
vi.mock("../services/notifications/pushSubscription", () => ({
    ensurePushSubscription: vi.fn(async () => true),
    initPushClickNavigation: vi.fn(),
    registerServiceWorker: vi.fn(async () => null),
}));

/** Stand-in for `navigator.serviceWorker`, which jsdom doesn't implement.
 *  Only `addEventListener` is exercised; the bridge listens and nothing else. */
const swListeners = new Set<(event: MessageEvent) => void>();

const installFakeServiceWorker = () => {
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
            addEventListener: (type: string, fn: (event: MessageEvent) => void) => {
                if (type === "message") swListeners.add(fn);
            },
        },
    });
};

/** Deliver a message as the worker would. */
const fromWorker = (data: unknown) => {
    for (const listener of swListeners) listener({ data } as MessageEvent);
};

/** Collect resync requests the bridge causes. */
const watchResyncs = () => {
    const seen: InboxResyncDetail[] = [];
    const onEvent = (event: Event) => {
        seen.push((event as CustomEvent<InboxResyncDetail>).detail);
    };
    window.addEventListener(INBOX_RESYNC_EVENT, onEvent);
    return { seen, stop: () => window.removeEventListener(INBOX_RESYNC_EVENT, onEvent) };
};

beforeEach(() => {
    vi.clearAllMocks();
    swListeners.clear();
    resetPushBridgeForTests();
    installFakeServiceWorker();
});

describe("pushBridge — push-received", () => {
    it("asks the inbox to resync when a reminder push lands", () => {
        const { seen, stop } = watchResyncs();
        initPushBridge(() => "token-1");

        fromWorker({ type: "push-received", tag: "todo_reminder:12", url: "/x" });

        // The tag rides along so the hook knows the worker has ALREADY shown a
        // card for this reminder and can skip its own, plainer one.
        expect(seen).toEqual([{ reason: "push", deliveredTag: "todo_reminder:12" }]);
        stop();
    });

    it("handles a message reminder the same way", () => {
        const { seen, stop } = watchResyncs();
        initPushBridge(() => "token-1");

        fromWorker({ type: "push-received", tag: "message_reminder:5" });

        expect(seen).toHaveLength(1);
        expect(seen[0].deliveredTag).toBe("message_reminder:5");
        stop();
    });

    it("ignores every other kind of push", () => {
        // A mention or DM push is about something a socket event already
        // delivered live. Resyncing for those would add a request per
        // backgrounded message and change nothing on screen.
        const { seen, stop } = watchResyncs();
        initPushBridge(() => "token-1");

        fromWorker({ type: "push-received", tag: "mention_chat:9" });
        fromWorker({ type: "push-received", tag: "agent_run_done:run-3" });
        fromWorker({ type: "push-received", tag: "" });
        fromWorker({ type: "push-received" });

        expect(seen).toEqual([]);
        stop();
    });
});

describe("pushBridge — push-subscription-changed", () => {
    it("re-registers the subscription with the current token", () => {
        initPushBridge(() => "token-1");

        fromWorker({ type: "push-subscription-changed", endpoint: "https://push.test/renewed" });

        expect(ensurePushSubscription).toHaveBeenCalledWith("token-1");
    });

    it("re-registers even when the worker failed to re-subscribe", () => {
        // `ensurePushSubscription` reads the live subscription itself, so it's
        // the right call either way — and it's the only code that can report a
        // dead endpoint to the server.
        initPushBridge(() => "token-1");

        fromWorker({ type: "push-subscription-changed", endpoint: "" });

        expect(ensurePushSubscription).toHaveBeenCalledWith("token-1");
    });

    it("reads the token at message time, not at install time", () => {
        // The listener is installed once and outlives any single token — the
        // whole point of taking a getter. A stale token here would mean the
        // repair 401s and the device stays silent.
        let token = "token-1";
        initPushBridge(() => token);
        token = "token-2";

        fromWorker({ type: "push-subscription-changed", endpoint: "e" });

        expect(ensurePushSubscription).toHaveBeenCalledWith("token-2");
    });
});

describe("pushBridge — installation", () => {
    it("binds only once, however many times it's called", () => {
        // It's called from an effect; a second binding would resync twice per
        // push and double every repair.
        const { seen, stop } = watchResyncs();
        initPushBridge(() => "token-1");
        initPushBridge(() => "token-1");
        initPushBridge(() => "token-1");

        expect(swListeners.size).toBe(1);
        fromWorker({ type: "push-received", tag: "todo_reminder:1" });
        expect(seen).toHaveLength(1);
        stop();
    });

    it("no-ops where service workers don't exist", () => {
        // Firefox private windows, and any browser with SW disabled. The rest
        // of the app must still boot.
        const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
        // @ts-expect-error — deleting an optional platform API for the test.
        delete navigator.serviceWorker;

        expect(() => initPushBridge(() => "token-1")).not.toThrow();
        expect(swListeners.size).toBe(0);

        if (original) Object.defineProperty(navigator, "serviceWorker", original);
    });

    it("ignores traffic that isn't one of its messages", () => {
        // `notification-click` shares this channel (handled elsewhere), and
        // any script on the page can postMessage anything.
        const { seen, stop } = watchResyncs();
        initPushBridge(() => "token-1");

        fromWorker({ type: "notification-click", url: "/workspace/chat" });
        fromWorker({ type: "something-else" });
        fromWorker("a bare string");
        fromWorker(null);
        fromWorker({ tag: "todo_reminder:1" });

        expect(seen).toEqual([]);
        expect(ensurePushSubscription).not.toHaveBeenCalled();
        stop();
    });
});
