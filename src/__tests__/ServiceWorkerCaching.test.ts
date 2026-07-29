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

function loadWorker(fetchImpl: ReturnType<typeof vi.fn>) {
    const listeners = new Map<string, Handler>();
    const self = {
        addEventListener: (type: string, fn: Handler) => listeners.set(type, fn),
        skipWaiting: vi.fn(),
        clients: {
            claim: vi.fn(async () => undefined),
            matchAll: vi.fn(async () => []),
            openWindow: vi.fn(async () => undefined),
        },
        location: { origin: ORIGIN },
        registration: { showNotification: vi.fn(async () => undefined) },
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
