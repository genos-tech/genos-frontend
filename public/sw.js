/* Minimal Web Push service worker (push + notificationclick only).
 *
 * Intentionally hand-written — NOT vite-plugin-pwa/Workbox: we don't want
 * precaching or PWA update semantics, just push delivery. The server sends
 * a JSON payload { title, body, icon?, url?, tag? }; we show it, and on
 * click we focus an existing app tab (and tell it to navigate) or open a
 * new one at the deep-link URL.
 */

self.addEventListener("install", () => {
    // Activate immediately so the first subscription works without a reload.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {};
    }
    const title = data.title || "New notification";
    const options = {
        body: data.body || "",
        // Card icon: the sender's avatar when the server supplies one,
        // else the app icon.
        icon: data.icon || "/genos_tech.png",
        badge: "/genos_tech.png",
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
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
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
