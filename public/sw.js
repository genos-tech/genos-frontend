/* Web Push + app-shell service worker.
 *
 * Still hand-written rather than vite-plugin-pwa/Workbox — we want to own
 * these caching rules explicitly, because the wrong one silently serves a
 * stale app forever. (This file previously said "no precaching, just push
 * delivery"; the shell/asset caching below is a deliberate reversal of
 * that, added for offline tolerance. Push is unchanged.)
 *
 * Push: the server sends { title, body, icon?, url?, tag? }; we show it,
 * and on click we focus an existing app tab (and tell it to navigate) or
 * open a new one at the deep-link URL.
 *
 * We also postMessage any open tab about the push channel itself — that a
 * push arrived (`push-received`) and that the browser rotated the
 * subscription (`push-subscription-changed`). Both are things only this
 * worker can see and only the page can act on; `pushBridge.ts` is the other
 * end of each. See those handlers for why they exist.
 *
 * Caching rules, and why each is what it is:
 *
 *   • Navigations → NETWORK-FIRST, falling back to the cached shell.
 *     Cache-first here would re-create the exact bug we fixed by adding
 *     `Cache-Control: no-cache` to index.html: a deployed change that
 *     users never see. Network-first means a fresh deploy always wins
 *     when online, and offline still gets an app instead of a browser
 *     error page.
 *   • /assets/** → CACHE-FIRST. Vite content-hashes these, so a given
 *     URL's bytes never change; a new deploy requests new filenames.
 *   • Everything else → passthrough, deliberately. The API, media and
 *     sockets are all cross-origin, so the same-origin guard already
 *     excludes them, and caching API responses is explicitly out of
 *     scope: stale task or chat data is worse than an honest error.
 *
 * The app's own offline data lives in IndexedDB (chat/task/note caches
 * and Yjs docs) — this worker only makes the shell reachable so that
 * layer gets a chance to render.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `genos-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `genos-assets-${CACHE_VERSION}`;

// Every SPA route is rewritten to index.html by the static server, so one
// cache entry serves as the fallback for all of them.
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
    // Activate immediately so the first subscription works without a reload.
    self.skipWaiting();
    // Warm the shell so the very first offline visit has something to show.
    // The `.catch` is load-bearing, not defensive noise: a rejected
    // `waitUntil` fails installation, the worker never activates, and push
    // delivery — this worker's original job — dies with it. An empty shell
    // cache just means the fallback is unavailable until the first online
    // navigation fills it.
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) => cache.add(SHELL_URL))
            .catch(() => {})
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Drop caches from older versions of this worker. Bumping
            // CACHE_VERSION is the kill switch for a bad cached shell:
            // sw.js is served with `Cache-Control: no-cache`, so browsers
            // revalidate it on navigation and a fix propagates promptly.
            const keep = [SHELL_CACHE, ASSET_CACHE];
            const names = await caches.keys();
            await Promise.all(
                names.map((name) => (keep.includes(name) ? undefined : caches.delete(name)))
            );
            await self.clients.claim();
        })().catch(() => {})
    );
});

// Store a copy without blocking the response the page is waiting on.
const putInCache = (cacheName, key, response) => {
    const copy = response.clone();
    caches
        .open(cacheName)
        .then((cache) => cache.put(key, copy))
        .catch(() => {});
};

const networkFirstShell = async (request) => {
    try {
        const response = await fetch(request);
        if (response && response.ok) putInCache(SHELL_CACHE, SHELL_URL, response);
        return response;
    } catch (err) {
        const cached = await caches.match(SHELL_URL);
        if (cached) return cached;
        // Nothing cached yet — let the browser show its own offline page,
        // which is more honest than a blank screen we invented.
        throw err;
    }
};

const cacheFirstAsset = async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) putInCache(ASSET_CACHE, request, response);
    return response;
};

self.addEventListener("fetch", (event) => {
    const request = event.request;
    // Never touch mutations: a cached POST/PATCH would be a correctness bug,
    // not a staleness one.
    if (request.method !== "GET") return;

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }

    // Cross-origin (API, media, sockets, analytics) passes straight through.
    if (url.origin !== self.location.origin) return;
    // Defensive: same-origin API paths would only exist behind a future
    // proxy, and they must never be served from cache.
    if (url.pathname.startsWith("/api/")) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirstShell(request));
        return;
    }

    if (url.pathname.startsWith("/assets/")) {
        event.respondWith(cacheFirstAsset(request));
    }
});

// App-icon badge (the counter chip on the installed app). The page owns
// this while it's open; the worker keeps it moving while the app is
// closed, which is the only time it can't be maintained in-app. The
// server sends `badge_count` when it knows the number; absent that we
// increment locally so the chip still reflects "something new".
let localBadgeCount = 0;

const setBadge = (count) => {
    if (typeof self.navigator === "undefined") return;
    if (typeof self.navigator.setAppBadge !== "function") return;
    localBadgeCount = Math.max(0, count);
    // Unsupported surfaces reject; never let that break push handling.
    self.navigator.setAppBadge(localBadgeCount).catch(() => {});
};

// Tell any open tab that a push arrived, so it can catch up on the data the
// push implies instead of waiting for a timer.
//
// The specific gap this closes: an inbox item filed by a backend cron (a
// reminder coming due) has no socket event, because that event is relayed by
// whichever client's request created the item and a cron has no client. The
// page therefore learns about the row from a poll, or not until a reload. A
// push is the one signal that is already correctly timed — it just wasn't
// being shared with the page.
//
// `tag` is the whole message: the server's reminder tags are
// `"<kind>:<reminder_id>"` (`message_reminders.fire`), so it says both what
// kind of thing arrived and which one — enough for the page to decide whether
// to sync, and to know the card above has ALREADY been shown for it. (There is
// no `category` in the payload to forward; the tag prefix is it.)
//
// Fire-and-forget: no tab open is the normal case, and the OS card has been
// shown regardless.
const announcePush = async (data) => {
    try {
        const allClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });
        for (const client of allClients) {
            client.postMessage({
                type: "push-received",
                tag: data.tag || "",
                url: data.url || "",
            });
        }
    } catch (e) {
        // A tab that went away mid-iteration must not break the card.
    }
};

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {};
    }
    setBadge(typeof data.badge_count === "number" ? data.badge_count : localBadgeCount + 1);
    const title = data.title || "New notification";
    const options = {
        body: data.body || "",
        // Card icon: the sender's avatar when the server supplies one,
        // else the app icon.
        // Opaque variants on purpose: the brand mark itself is transparent,
        // and notification surfaces composite it on their own background
        // (black on some Android themes), which would swallow a dark logo.
        icon: data.icon || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || undefined,
        // Large hero image (Chrome desktop/Android), when supplied.
        image: data.image || undefined,
        // Action buttons, e.g. [{ action: "open", title: "Open" }].
        // notificationclick opens data.url for any action (incl. body click).
        actions: Array.isArray(data.actions) ? data.actions : undefined,
        // Keep the card until the user dismisses it (vs. auto-hide).
        requireInteraction: data.requireInteraction === true,
        // Suppress the OS sound/vibration when the server asks (per-category).
        silent: data.silent === true,
        data: { url: data.url || "/" },
    };
    event.waitUntil(
        Promise.all([self.registration.showNotification(title, options), announcePush(data)])
    );
});

// The browser can retire a push subscription on its own — Chrome does it when
// the push service rotates its endpoint, and a `permissions` change can too.
// Until now nothing noticed: the page only re-subscribes on load, so a device
// stayed silently unsubscribed until its next reload, which for a long-lived
// laptop tab can be days. That is one of the two ways a device ends up
// receiving no reminders while another device on the same account gets them.
//
// The worker can restore the browser's half itself (re-subscribing with the
// same VAPID key it was given), but it CANNOT tell the server: that needs the
// user's access token, which lives in the page. So do both halves — resubscribe
// here, and ask any open tab to re-register the new endpoint. With no tab open
// the page's own boot-time `ensurePushSubscription` picks it up, which is why
// the resubscribe is worth doing even when nobody is listening.
self.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil(
        (async () => {
            const key =
                event.oldSubscription && event.oldSubscription.options
                    ? event.oldSubscription.options.applicationServerKey
                    : null;
            let renewed = null;
            try {
                renewed =
                    event.newSubscription ||
                    (key
                        ? await self.registration.pushManager.subscribe({
                              userVisibleOnly: true,
                              applicationServerKey: key,
                          })
                        : null);
            } catch (e) {
                // Subscribing can fail (permission revoked, no network). The
                // page's next boot retries; nothing else to do from here.
            }
            const allClients = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            for (const client of allClients) {
                client.postMessage({
                    type: "push-subscription-changed",
                    endpoint: renewed ? renewed.endpoint : "",
                });
            }
        })()
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    // Opening the app hands badge ownership back to the page, which
    // recomputes it from real unread counts on mount (`useAppBadge`).
    // Clearing here avoids a stale number during the launch window.
    setBadge(0);
    const rawUrl = (event.notification.data && event.notification.data.url) || "/";
    const targetUrl = new URL(rawUrl, self.location.origin).href;

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            // Reuse an existing app tab: focus it and let the page navigate
            // (SPA route + the URL-preview modal) rather than a full reload.
            for (const client of allClients) {
                if (client.url.startsWith(self.location.origin)) {
                    await client.focus();
                    client.postMessage({ type: "notification-click", url: targetUrl });
                    return;
                }
            }
            // No tab open: open one at the deep-link URL.
            if (self.clients.openWindow) {
                await self.clients.openWindow(targetUrl);
            }
        })()
    );
});
