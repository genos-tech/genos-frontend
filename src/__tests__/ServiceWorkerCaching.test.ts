/**
 * `public/sw.js` behavior tests.
 *
 * This file is invisible to every other check we run: it isn't in `src`,
 * so `tsc -b` and `eslint src` skip it, and nothing imports it. A typo
 * there ships to every user and *persists in their browser*, so the
 * caching rules are pinned here instead. The test loads the real file
 * (which also makes a syntax error fail the suite) into a simulated
 * ServiceWorkerGlobalScope and dispatches synthetic events.
 *
 * The rule that matters most: navigations must be NETWORK-first. Cache-
 * first there would re-create the stale-deploy bug that adding
 * `Cache-Control: no-cache` to index.html fixed.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SW_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/sw.js");
const ORIGIN = "https://app.test";

type Handler = (event: unknown) => void;

/** Minimal Response stand-in: the worker only needs ok/clone. */
function fakeResponse(body: string, ok = true) {
    const res = { body, ok, clone: () => ({ ...res, clone: () => res }) };
    return res;
}

const keyOf = (key: unknown): string =>
    typeof key === "string" ? key : ((key as { url: string }).url ?? String(key));

function makeCaches() {
    const stores = new Map<string, Map<string, unknown>>();
    const openStore = (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name)!;
    };
    return {
        stores,
        addShouldReject: false,
        api: {
            open: vi.fn(async (name: string) => {
                const store = openStore(name);
                return {
                    put: vi.fn(async (key: unknown, res: unknown) => {
                        store.set(keyOf(key), res);
                    }),
                    add: vi.fn(async (key: string) => {
                        if (harness.addShouldReject) throw new Error("offline at install");
                        store.set(keyOf(key), fakeResponse("precached-shell"));
                    }),
                    match: vi.fn(async (key: unknown) => store.get(keyOf(key))),
                };
            }),
            match: vi.fn(async (key: unknown) => {
                for (const store of stores.values()) {
                    const hit = store.get(keyOf(key));
                    if (hit) return hit;
                }
                return undefined;
            }),
            keys: vi.fn(async () => Array.from(stores.keys())),
            delete: vi.fn(async (name: string) => stores.delete(name)),
        },
    };
}

let harness: ReturnType<typeof makeCaches>;

/** An open tab, as the worker sees it. Only `url`/`focus`/`postMessage` are
 *  ever touched. Declared as a type so `matchAll` can be *typed* as returning
 *  these — tests hand it clients via `mockResolvedValue`, and an inferred
 *  `never[]` would reject them. */
type FakeClient = {
    url: string;
    /** Undefined for the tests that predate the announce handshake — the
     *  worker only ever treats an explicit `"visible"` as on screen. */
    visibilityState?: string;
    focus: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
};

const makeClient = (url = `${ORIGIN}/workspace`, visibilityState?: string): FakeClient => ({
    url,
    visibilityState,
    focus: vi.fn(async () => undefined),
    postMessage: vi.fn(),
});

/** A visible tab that answers the worker's "will you announce this?" offer.
 *  The real answer comes from `pushBridge.ts`; this is just the port shape. */
const makeAnsweringClient = (handled: boolean, url = `${ORIGIN}/workspace`): FakeClient => {
    const client = makeClient(url, "visible");
    client.postMessage.mockImplementation((_message: unknown, transfer?: MessagePort[]) => {
        transfer?.[0]?.postMessage({ handled });
    });
    return client;
};

function loadWorker(fetchImpl: ReturnType<typeof vi.fn>) {
    const listeners = new Map<string, Handler>();
    const self = {
        addEventListener: (type: string, fn: Handler) => listeners.set(type, fn),
        skipWaiting: vi.fn(),
        clients: {
            claim: vi.fn(async () => undefined),
            matchAll: vi.fn(async (): Promise<FakeClient[]> => []),
            openWindow: vi.fn(async () => undefined),
        },
        location: { origin: ORIGIN },
        registration: {
            showNotification: vi.fn(async () => undefined),
            pushManager: {
                subscribe: vi.fn(async () => ({ endpoint: "https://push.test/renewed" })),
            },
        },
        navigator: { setAppBadge: vi.fn(async () => undefined) },
    };
    const src = readFileSync(SW_PATH, "utf-8");
    // eslint-disable-next-line no-new-func
    new Function("self", "caches", "fetch", src)(self, harness.api, fetchImpl);
    return { listeners, self };
}

/** Dispatch a fetch event and return what the worker responded with
 *  (or `undefined` when it declined to intercept). */
function dispatchFetch(
    listeners: Map<string, Handler>,
    request: { url: string; method?: string; mode?: string }
) {
    let responded: Promise<unknown> | undefined;
    const req = { method: "GET", mode: "no-cors", ...request };
    listeners.get("fetch")!({
        request: req,
        respondWith: (p: Promise<unknown>) => {
            responded = p;
        },
    });
    return responded;
}

beforeEach(() => {
    harness = makeCaches();
});

describe("sw.js — navigations are network-first", () => {
    it("serves the network response and caches it as the shell", async () => {
        const network = vi.fn(async () => fakeResponse("fresh-shell"));
        const { listeners } = loadWorker(network);

        const res = (await dispatchFetch(listeners, {
            url: `${ORIGIN}/workspace/chat`,
            mode: "navigate",
        })) as { body: string };

        expect(res.body).toBe("fresh-shell");
        expect(network).toHaveBeenCalledTimes(1);
        // Cached under a single shell key, not per-route.
        const shell = await harness.api.match("/");
        expect(shell).toBeDefined();
    });

    it("a deployed change is never masked by the cache while online", async () => {
        const network = vi.fn(async () => fakeResponse("v2-shell"));
        const { listeners } = loadWorker(network);
        // Pre-seed a stale shell — the exact stale-deploy scenario.
        // Seeded under BOTH the shell key and the full navigation URL: with
        // only one of them, a cache-first implementation could "pass" this
        // test by missing the cache on a key mismatch rather than by
        // actually going to the network.
        const cache = await harness.api.open("genos-shell-v1");
        await cache.put("/", fakeResponse("v1-stale-shell"));
        await cache.put(`${ORIGIN}/workspace`, fakeResponse("v1-stale-shell"));

        const res = (await dispatchFetch(listeners, {
            url: `${ORIGIN}/workspace`,
            mode: "navigate",
        })) as { body: string };

        expect(res.body).toBe("v2-shell");
    });

    it("falls back to the cached shell when the network fails", async () => {
        const network = vi.fn(async () => {
            throw new Error("offline");
        });
        const { listeners } = loadWorker(network);
        const cache = await harness.api.open("genos-shell-v1");
        await cache.put("/", fakeResponse("cached-shell"));

        const res = (await dispatchFetch(listeners, {
            url: `${ORIGIN}/workspace/tasks`,
            mode: "navigate",
        })) as { body: string };

        expect(res.body).toBe("cached-shell");
    });

    it("rejects when offline with nothing cached, so the browser shows its own page", async () => {
        const network = vi.fn(async () => {
            throw new Error("offline");
        });
        const { listeners } = loadWorker(network);

        await expect(
            dispatchFetch(listeners, { url: `${ORIGIN}/`, mode: "navigate" })
        ).rejects.toThrow("offline");
    });
});

describe("sw.js — hashed assets are cache-first", () => {
    it("returns the cached asset without hitting the network", async () => {
        const network = vi.fn(async () => fakeResponse("from-network"));
        const { listeners } = loadWorker(network);
        const cache = await harness.api.open("genos-assets-v1");
        await cache.put(`${ORIGIN}/assets/index-abc123.js`, fakeResponse("from-cache"));

        const res = (await dispatchFetch(listeners, {
            url: `${ORIGIN}/assets/index-abc123.js`,
        })) as { body: string };

        expect(res.body).toBe("from-cache");
        expect(network).not.toHaveBeenCalled();
    });

    it("fetches and stores an asset that isn't cached yet", async () => {
        const network = vi.fn(async () => fakeResponse("downloaded"));
        const { listeners } = loadWorker(network);

        const res = (await dispatchFetch(listeners, {
            url: `${ORIGIN}/assets/index-def456.js`,
        })) as { body: string };

        expect(res.body).toBe("downloaded");
        expect(network).toHaveBeenCalledTimes(1);
    });
});

describe("sw.js — what it must never intercept", () => {
    const cases: Array<[string, { url: string; method?: string; mode?: string }]> = [
        ["cross-origin API calls", { url: "https://api.test/api/v2/chats", mode: "cors" }],
        ["cross-origin media", { url: "https://api.test/media/avatar.png" }],
        ["same-origin /api/ paths", { url: `${ORIGIN}/api/v2/tasks`, mode: "cors" }],
        ["non-GET requests", { url: `${ORIGIN}/`, method: "POST", mode: "navigate" }],
        ["uncached same-origin extras", { url: `${ORIGIN}/manifest.webmanifest` }],
    ];

    it.each(cases)("does not intercept %s", async (_label, request) => {
        const network = vi.fn(async () => fakeResponse("network"));
        const { listeners } = loadWorker(network);
        expect(dispatchFetch(listeners, request)).toBeUndefined();
    });
});

describe("sw.js — lifecycle", () => {
    it("install still resolves when precaching fails, so push survives", async () => {
        harness.addShouldReject = true;
        const { listeners, self } = loadWorker(vi.fn());

        let waited: Promise<unknown> | undefined;
        listeners.get("install")!({
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });

        // A rejected waitUntil fails installation — the worker would never
        // activate and push delivery would die with it.
        await expect(waited).resolves.not.toThrow();
        expect(self.skipWaiting).toHaveBeenCalled();
    });

    it("activate drops stale cache versions and keeps the current ones", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        await harness.api.open("genos-shell-v1");
        await harness.api.open("genos-assets-v1");
        await harness.api.open("genos-shell-v0-old");

        let waited: Promise<unknown> | undefined;
        listeners.get("activate")!({
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });
        await waited;

        expect(Array.from(harness.stores.keys())).toEqual(["genos-shell-v1", "genos-assets-v1"]);
        expect(self.clients.claim).toHaveBeenCalled();
    });

    it("still shows a push notification (caching must not break push)", async () => {
        const { listeners, self } = loadWorker(vi.fn());

        let waited: Promise<unknown> | undefined;
        listeners.get("push")!({
            data: { json: () => ({ title: "Hi", body: "You were mentioned" }) },
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });
        await waited;

        expect(self.registration.showNotification).toHaveBeenCalledWith(
            "Hi",
            expect.objectContaining({ body: "You were mentioned" })
        );
    });
});

/**
 * The app-icon badge (the counter chip on the installed app).
 *
 * Two writers share it, and the rule is "whoever is on screen owns it": the
 * page (`useAppBadge`) while the app is open, this worker while it is not.
 * The reported failure was the worker breaking that rule: a push that arrived
 * while the app was open (or a notification click on an open app) overwrote the
 * page's correct number with the server's, and the page, whose own count had
 * not changed, never wrote it back. So the worker writes only when no window of
 * the app is visible, and never zeroes the icon on a click.
 *
 * The count is updated synchronously, before the worker has looked at any
 * window; only the WRITE waits for that look. Two pushes in quick succession
 * must therefore still count 1 then 2, and whichever write lands last must
 * carry the newest number.
 */
describe("sw.js — app-icon badge", () => {
    /** Fire a push and hand back the promise the worker gave `waitUntil`. It is
     *  not awaited here, so a case can let two pushes overlap. */
    const firePush = (listeners: Map<string, Handler>, data: Record<string, unknown>) => {
        let waited: Promise<unknown> = Promise.resolve();
        listeners.get("push")!({
            data: { json: () => data },
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });
        return waited;
    };

    const visibleTab = () => makeClient(`${ORIGIN}/workspace`, "visible");
    const hiddenTab = () => makeClient(`${ORIGIN}/workspace`, "hidden");

    describe("while no window of the app is on screen", () => {
        it("sets the icon to the server's count", async () => {
            const { listeners, self } = loadWorker(vi.fn());

            await firePush(listeners, { title: "Hi", body: "b", badge_count: 7 });

            expect(self.navigator.setAppBadge).toHaveBeenCalledTimes(1);
            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(7);
        });

        it("sets the icon to 0 when the server says 0, rather than ignoring it", async () => {
            const { listeners, self } = loadWorker(vi.fn());

            await firePush(listeners, { title: "Hi", badge_count: 0 });

            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(0);
        });

        it("increments locally when the server sends no count", async () => {
            const { listeners, self } = loadWorker(vi.fn());

            await firePush(listeners, { title: "Hi", body: "b" });
            await firePush(listeners, { title: "Hi", body: "b" });

            expect(self.navigator.setAppBadge).toHaveBeenNthCalledWith(1, 1);
            expect(self.navigator.setAppBadge).toHaveBeenNthCalledWith(2, 2);
        });

        it("counts two pushes that overlap as 2, not 1 twice", async () => {
            // Both pushes start before either window lookup has finished.
            const { listeners, self } = loadWorker(vi.fn());

            await Promise.all([
                firePush(listeners, { title: "A" }),
                firePush(listeners, { title: "B" }),
            ]);

            // A count that was read before the lookup and written back after
            // it would have both pushes read 0 and leave the icon on 1.
            const writes = self.navigator.setAppBadge.mock.calls.map((c) => c[0]);
            expect(writes.at(-1)).toBe(2);
        });

        it("leaves the NEWEST count on the icon when the window lookups finish out of order", async () => {
            // The first push's lookup is slow, the second's is quick. The
            // newer push is the one whose number is right, so it must win
            // whether the count is taken after the lookup (the older number
            // would be taken last) or captured at push time and written then
            // (the older number would be written last).
            const { listeners, self } = loadWorker(vi.fn());
            let releaseFirst: (tabs: FakeClient[]) => void = () => {};
            self.clients.matchAll
                .mockImplementationOnce(
                    () =>
                        new Promise<FakeClient[]>((resolve) => {
                            releaseFirst = resolve;
                        })
                )
                .mockImplementationOnce(async () => []);

            const first = firePush(listeners, { title: "A", badge_count: 5 });
            const second = firePush(listeners, { title: "B", badge_count: 6 });
            await second;
            releaseFirst([]);
            await first;

            const writes = self.navigator.setAppBadge.mock.calls.map((c) => c[0]);
            expect(writes.at(-1)).toBe(6);
        });

        it("still writes when the windows cannot be listed", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockRejectedValue(new Error("no clients"));

            await firePush(listeners, { title: "Hi", badge_count: 4 });

            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(4);
            expect(self.registration.showNotification).toHaveBeenCalled();
        });

        it("writes when the only window is hidden", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockResolvedValue([hiddenTab()]);

            await firePush(listeners, { title: "Hi", badge_count: 7 });

            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(7);
        });

        it("treats a window that does not report its visibility as not on screen", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockResolvedValue([makeClient()]);

            await firePush(listeners, { title: "Hi", badge_count: 7 });

            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(7);
        });

        it("does not let a failing Badging API break the notification", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.navigator.setAppBadge.mockRejectedValue(new Error("not allowed"));

            await expect(firePush(listeners, { title: "Hi", body: "b" })).resolves.not.toThrow();

            expect(self.navigator.setAppBadge).toHaveBeenCalledTimes(1);
            expect(self.registration.showNotification).toHaveBeenCalledWith(
                "Hi",
                expect.objectContaining({ body: "b" })
            );
        });

        it("copes with a browser that has no Badging API", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            delete (self.navigator as { setAppBadge?: unknown }).setAppBadge;

            await expect(firePush(listeners, { title: "Hi" })).resolves.not.toThrow();

            expect(self.registration.showNotification).toHaveBeenCalled();
        });
    });

    describe("while a window of the app is on screen", () => {
        it("leaves the icon to the page, whatever number the server sent", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockResolvedValue([visibleTab()]);

            await firePush(listeners, { title: "Hi", badge_count: 7 });

            expect(self.navigator.setAppBadge).not.toHaveBeenCalled();
        });

        it("leaves it to the page when only one of several windows is visible", async () => {
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockResolvedValue([hiddenTab(), visibleTab()]);

            await firePush(listeners, { title: "Hi", badge_count: 7 });

            expect(self.navigator.setAppBadge).not.toHaveBeenCalled();
        });

        it("still shows the notification and tells the tab", async () => {
            // Only the badge is the page's to own; everything else about a
            // push is unchanged.
            const { listeners, self } = loadWorker(vi.fn());
            const tab = visibleTab();
            self.clients.matchAll.mockResolvedValue([tab]);

            await firePush(listeners, { title: "Hi", body: "b", badge_count: 7, tag: "x:1" });

            expect(self.registration.showNotification).toHaveBeenCalled();
            expect(tab.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: "push-received", tag: "x:1" })
            );
        });

        it("remembers the server's count, so a later write continues from it", async () => {
            // The icon isn't touched here, but the number is still the best
            // the worker knows. When the app is later closed and a push comes
            // without a count, +1 should build on it rather than on 0.
            const { listeners, self } = loadWorker(vi.fn());
            self.clients.matchAll.mockResolvedValueOnce([visibleTab()]);
            await firePush(listeners, { title: "Hi", badge_count: 7 });
            expect(self.navigator.setAppBadge).not.toHaveBeenCalled();

            self.clients.matchAll.mockResolvedValue([]);
            await firePush(listeners, { title: "Hi" });

            expect(self.navigator.setAppBadge).toHaveBeenCalledTimes(1);
            expect(self.navigator.setAppBadge).toHaveBeenCalledWith(8);
        });
    });

    describe("opening a notification", () => {
        const click = (listeners: Map<string, Handler>) => {
            let waited: Promise<unknown> = Promise.resolve();
            listeners.get("notificationclick")!({
                notification: { close: vi.fn(), data: { url: "/workspace/chat" } },
                waitUntil: (p: Promise<unknown>) => {
                    waited = p;
                },
            });
            return waited;
        };

        it("does not touch the icon: opening one notification reads nothing else", async () => {
            // It used to zero the icon. With the app already open and visible,
            // focusing the tab fires no visibility change, so the page never
            // wrote its real count back and a 0 stood while items were unread.
            // With the app closed, the page writes its real count on launch.
            const { listeners, self } = loadWorker(vi.fn());
            const tab = visibleTab();
            self.clients.matchAll.mockResolvedValue([tab]);

            await click(listeners);

            expect(self.navigator.setAppBadge).not.toHaveBeenCalled();
            // The navigation itself is unchanged.
            expect(tab.focus).toHaveBeenCalled();
            expect(tab.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: "notification-click" })
            );
        });

        it("does not touch the icon when it has to open a new window either", async () => {
            const { listeners, self } = loadWorker(vi.fn());

            await click(listeners);

            expect(self.clients.openWindow).toHaveBeenCalled();
            expect(self.navigator.setAppBadge).not.toHaveBeenCalled();
        });
    });
});

/**
 * The worker also tells open tabs about the push channel itself. Both messages
 * exist because the worker can see something the page cannot, and both were
 * added for one reported failure: reminders arriving on a phone and never on a
 * laptop. `pushBridge.ts` is the other end; these tests pin the shapes it
 * matches on, which is the only thing holding the two halves together.
 */
describe("sw.js — telling the page about the push channel", () => {
    /** Drive the `push` handler and wait for everything it promised to do. */
    const push = async (listeners: Map<string, Handler>, data: Record<string, unknown>) => {
        let waited: Promise<unknown> | undefined;
        listeners.get("push")!({
            data: { json: () => data },
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });
        await waited;
    };

    it("forwards an arriving push to every open tab", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        const a = makeClient(`${ORIGIN}/workspace/inbox`);
        const b = makeClient(`${ORIGIN}/workspace/todo`);
        self.clients.matchAll.mockResolvedValue([a, b]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12", url: "/x" });

        // The tag is the whole message: it says what arrived AND that a card
        // has already been shown for it, which is how the page avoids raising
        // a second, plainer one.
        const expected = { type: "push-received", tag: "todo_reminder:12", url: "/x" };
        expect(a.postMessage).toHaveBeenCalledWith(expected);
        expect(b.postMessage).toHaveBeenCalledWith(expected);
    });

    it("includes tabs this worker doesn't control", async () => {
        // A tab loaded before the worker activated is uncontrolled but very
        // much open and showing a stale inbox — the exact tab that needs this.
        const { listeners, self } = loadWorker(vi.fn());
        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });

        expect(self.clients.matchAll).toHaveBeenCalledWith(
            expect.objectContaining({ type: "window", includeUncontrolled: true })
        );
    });

    it("forwards even a push with no tag, rather than guessing", async () => {
        // Deciding what's interesting is the page's job (`isReminderTag`);
        // filtering here would put that rule in two places.
        const { listeners, self } = loadWorker(vi.fn());
        const client = makeClient();
        self.clients.matchAll.mockResolvedValue([client]);

        await push(listeners, { title: "Hi" });

        expect(client.postMessage).toHaveBeenCalledWith({
            type: "push-received",
            tag: "",
            url: "",
        });
    });

    it("still shows the card when a tab goes away mid-announce", async () => {
        // `postMessage` on a client that just closed throws. The OS card is
        // the user-visible half and must not be lost to that.
        const { listeners, self } = loadWorker(vi.fn());
        const dead = makeClient();
        dead.postMessage.mockImplementation(() => {
            throw new Error("client is gone");
        });
        self.clients.matchAll.mockResolvedValue([dead]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });

        expect(self.registration.showNotification).toHaveBeenCalled();
    });

    it("still shows the card when there is no tab to tell", async () => {
        // The normal case for a reminder: nobody's looking, which is why the
        // push exists at all.
        const { listeners, self } = loadWorker(vi.fn());
        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });
        expect(self.registration.showNotification).toHaveBeenCalled();
    });

    // The app's one rule is "the tab you're looking at toasts; the OS card is
    // for when you aren't". Every category gets that from the server, which
    // skips the push for a device with a visible tab — except reminders, which
    // opt out of that gate so a rotted subscription can't swallow them. So for
    // reminders the choice is made here, by ASKING rather than by reading
    // `visibilityState` alone: this worker claims pages older than itself, and
    // a pre-handshake bundle suppresses its own notice expecting a card.

    it("leaves the card to a visible tab that will announce the reminder itself", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        self.clients.matchAll.mockResolvedValue([makeAnsweringClient(true)]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });

        expect(self.registration.showNotification).not.toHaveBeenCalled();
    });

    it("shows the card when the visible tab declines", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        self.clients.matchAll.mockResolvedValue([makeAnsweringClient(false)]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });

        expect(self.registration.showNotification).toHaveBeenCalled();
    });

    it("shows the card when a visible tab never answers", async () => {
        // A tab on a bundle from before the handshake: it gets the message,
        // ignores the port, and stays quiet expecting a card. Waiting for the
        // silence and then showing one is what stops that tab going dark for
        // as long as it stays open.
        vi.useFakeTimers();
        try {
            const { listeners, self } = loadWorker(vi.fn());
            const mute = makeClient(`${ORIGIN}/workspace`, "visible");
            self.clients.matchAll.mockResolvedValue([mute]);

            let waited: Promise<unknown> | undefined;
            listeners.get("push")!({
                data: { json: () => ({ title: "Reminder", tag: "todo_reminder:12" }) },
                waitUntil: (p: Promise<unknown>) => {
                    waited = p;
                },
            });
            await vi.advanceTimersByTimeAsync(1600);
            await waited;

            expect(self.registration.showNotification).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("never offers the choice for a push the page cannot announce", async () => {
        // A DM or mention: the page has no path that raises one of these from a
        // push, so withholding the card would be silence. Only the reminder
        // prefixes qualify, and they must match `isReminderTag`.
        const { listeners, self } = loadWorker(vi.fn());
        const visible = makeAnsweringClient(true);
        self.clients.matchAll.mockResolvedValue([visible]);

        await push(listeners, { title: "DM", tag: "chats:c1" });

        expect(self.registration.showNotification).toHaveBeenCalled();
        // One argument, i.e. no port: nothing was asked of it.
        expect(visible.postMessage).toHaveBeenCalledWith({
            type: "push-received",
            tag: "chats:c1",
            url: "",
        });
    });

    it("does not ask a hidden tab, and still tells it", async () => {
        // Hidden is precisely when the card is the right surface.
        const { listeners, self } = loadWorker(vi.fn());
        const hidden = makeAnsweringClient(true);
        hidden.visibilityState = "hidden";
        self.clients.matchAll.mockResolvedValue([hidden]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12", url: "/x" });

        expect(self.registration.showNotification).toHaveBeenCalled();
        expect(hidden.postMessage).toHaveBeenCalledWith({
            type: "push-received",
            tag: "todo_reminder:12",
            url: "/x",
        });
    });

    it("asks only the visible tab, and tells the background one anyway", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        const visible = makeAnsweringClient(true, `${ORIGIN}/workspace/todo`);
        const background = makeClient(`${ORIGIN}/workspace/inbox`, "hidden");
        self.clients.matchAll.mockResolvedValue([visible, background]);

        await push(listeners, { title: "Reminder", tag: "todo_reminder:12" });

        expect(self.registration.showNotification).not.toHaveBeenCalled();
        // The background tab still needs the row synced, even though it is the
        // visible one that will show it.
        expect(background.postMessage).toHaveBeenCalledWith({
            type: "push-received",
            tag: "todo_reminder:12",
            url: "",
        });
    });
});

/**
 * A browser can retire a push subscription on its own. Until this handler
 * existed nothing noticed: the page only re-subscribes on load, so a laptop
 * tab left open for days stayed silently unsubscribed for days — one of the
 * two ways a device receives no reminders while another on the same account
 * does.
 */
describe("sw.js — pushsubscriptionchange", () => {
    const KEY = new Uint8Array([1, 2, 3]);

    /** Drive the handler and wait for the work it queued. */
    const rotate = async (listeners: Map<string, Handler>, event: Record<string, unknown>) => {
        let waited: Promise<unknown> | undefined;
        listeners.get("pushsubscriptionchange")!({
            ...event,
            waitUntil: (p: Promise<unknown>) => {
                waited = p;
            },
        });
        await waited;
    };

    it("re-subscribes with the same VAPID key the old subscription used", async () => {
        const { listeners, self } = loadWorker(vi.fn());

        await rotate(listeners, {
            oldSubscription: { options: { applicationServerKey: KEY } },
        });

        // Re-subscribing with a *different* key silently produces a
        // subscription our server can't push to.
        expect(self.registration.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: KEY,
        });
    });

    it("asks the page to register the new endpoint", async () => {
        // The worker restores the browser's half but cannot tell the server —
        // that needs the user's token, which only the page has.
        const { listeners, self } = loadWorker(vi.fn());
        const client = makeClient();
        self.clients.matchAll.mockResolvedValue([client]);

        await rotate(listeners, {
            oldSubscription: { options: { applicationServerKey: KEY } },
        });

        expect(client.postMessage).toHaveBeenCalledWith({
            type: "push-subscription-changed",
            endpoint: "https://push.test/renewed",
        });
    });

    it("uses the subscription the browser already made, when it supplies one", async () => {
        const { listeners, self } = loadWorker(vi.fn());
        const client = makeClient();
        self.clients.matchAll.mockResolvedValue([client]);

        await rotate(listeners, {
            oldSubscription: { options: { applicationServerKey: KEY } },
            newSubscription: { endpoint: "https://push.test/from-browser" },
        });

        expect(self.registration.pushManager.subscribe).not.toHaveBeenCalled();
        expect(client.postMessage).toHaveBeenCalledWith({
            type: "push-subscription-changed",
            endpoint: "https://push.test/from-browser",
        });
    });

    it("still nudges the page when re-subscribing fails", async () => {
        // Permission revoked, or offline. The page's `ensurePushSubscription`
        // reads the live subscription itself and is the one that can report a
        // dead one to the server, so it must hear about this either way.
        const { listeners, self } = loadWorker(vi.fn());
        const client = makeClient();
        self.clients.matchAll.mockResolvedValue([client]);
        self.registration.pushManager.subscribe.mockRejectedValue(new Error("denied"));

        await rotate(listeners, {
            oldSubscription: { options: { applicationServerKey: KEY } },
        });

        expect(client.postMessage).toHaveBeenCalledWith({
            type: "push-subscription-changed",
            endpoint: "",
        });
    });

    it("doesn't blind-subscribe when there is no key to reuse", async () => {
        // Safari sends the event with neither subscription populated. A
        // keyless `subscribe()` either throws or yields something unusable.
        const { listeners, self } = loadWorker(vi.fn());
        const client = makeClient();
        self.clients.matchAll.mockResolvedValue([client]);

        await rotate(listeners, {});

        expect(self.registration.pushManager.subscribe).not.toHaveBeenCalled();
        expect(client.postMessage).toHaveBeenCalledWith({
            type: "push-subscription-changed",
            endpoint: "",
        });
    });
});
