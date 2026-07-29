// Web Push subscribe/unsubscribe + service-worker wiring. Drives OS
// notifications when the app tab is hidden or closed (the in-app
// `NotificationManager` keeps handling the visible/foreground case).
//
// Everything no-ops gracefully when unsupported, permission isn't granted,
// or `VITE_VAPID_PUBLIC_KEY` is unset — so the app is unaffected until push
// is configured.

import { deletePushSubscription, registerPushSubscription } from "./notificationApi";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const isPushSupported = (): boolean =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined" &&
    window.isSecureContext === true;

// VAPID public keys travel as base64url; the Push API wants a Uint8Array.
// Backed by an explicit ArrayBuffer so the type is `Uint8Array<ArrayBuffer>`
// (TS 5.7+'s `BufferSource` rejects the `ArrayBufferLike`-backed default).
const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const buffer = new ArrayBuffer(raw.length);
    const output = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
};

// True when an existing subscription was created with `desiredKey`. A
// browser that doesn't expose `options.applicationServerKey` returns null —
// treat that as "can't tell, assume OK" to avoid needless re-subscribe
// churn (Chrome, the case that matters here, does expose it).
const appServerKeyMatches = (sub: PushSubscription, desiredKey: Uint8Array): boolean => {
    const existing = sub.options.applicationServerKey;
    if (!existing) return true;
    const a = new Uint8Array(existing);
    if (a.length !== desiredKey.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== desiredKey[i]) return false;
    }
    return true;
};

// Registration only needs the Service Worker API — deliberately NOT
// isPushSupported(): iOS Safari exposes PushManager only inside an
// installed PWA, but the worker must already be registered for the
// install itself to be offered and for push to work post-install.
const isServiceWorkerSupported = (): boolean =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    window.isSecureContext === true;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

const registerServiceWorker = (): Promise<ServiceWorkerRegistration | null> => {
    if (!isServiceWorkerSupported()) return Promise.resolve(null);
    if (!registrationPromise) {
        registrationPromise = navigator.serviceWorker.register("/sw.js").catch((err) => {
            console.warn("[push] service worker registration failed", err);
            registrationPromise = null;
            return null;
        });
    }
    return registrationPromise;
};

/**
 * Register the service worker at app boot, independent of notification
 * permission. Subscribing to push stays gated on permission
 * (`ensurePushSubscription`); registration must not be, or the PWA has no
 * worker at all until the user happens to grant notifications.
 */
export const registerServiceWorkerOnBoot = (): void => {
    void registerServiceWorker();
};

/**
 * Ensure the browser is subscribed and the subscription is stored
 * server-side. Returns true when an active subscription exists — the caller
 * uses this to let the service worker own OS notifications. Idempotent:
 * re-uses an existing subscription, and the server upserts by endpoint.
 */
export const ensurePushSubscription = async (
    accessToken: string | null | undefined
): Promise<boolean> => {
    if (!isPushSupported()) return false;
    if (Notification.permission !== "granted") return false;
    if (!VAPID_PUBLIC_KEY) {
        return false;
    }
    const reg = await registerServiceWorker();
    if (!reg) return false;
    try {
        const ready = await navigator.serviceWorker.ready;
        const desiredKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        let sub = await ready.pushManager.getSubscription();
        // An existing subscription created with a DIFFERENT VAPID public key
        // (key rotated, or FE/BE keys drifted) is unusable: the server signs
        // with the new key and the push service 403s ("credentials do not
        // correspond"). Drop it and re-subscribe with the current key.
        if (sub && !appServerKeyMatches(sub, desiredKey)) {
            try {
                await sub.unsubscribe();
            } catch {
                // best-effort — we re-subscribe regardless
            }
            sub = null;
        }
        if (!sub) {
            sub = await ready.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: desiredKey,
            });
        }
        const json = sub.toJSON();
        const endpoint = json.endpoint;
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;
        if (!endpoint || !p256dh || !auth) return false;
        return await registerPushSubscription(accessToken, {
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
        });
    } catch (err) {
        console.warn("[push] subscribe failed", err);
        return false;
    }
};

/** Drop the local subscription and tell the server to forget it (logout). */
export const unsubscribeFromPush = async (
    accessToken: string | null | undefined
): Promise<void> => {
    if (!isPushSupported()) return;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!sub) return;
        const { endpoint } = sub;
        await sub.unsubscribe();
        await deletePushSubscription(accessToken, endpoint);
    } catch (err) {
        console.warn("[push] unsubscribe failed", err);
    }
};

let clickNavInstalled = false;

/**
 * Wire the service worker's "notification-click" message (sent when the
 * user clicks a push while an app tab is open) to a navigation. Uses a
 * same-tab location change so the existing route parser (`useChatRouting`)
 * + URL-preview modal deep-link the target. Safe to call repeatedly.
 *
 * (The app-closed case is handled entirely in the SW via `openWindow`.)
 */
export const initPushClickNavigation = (): void => {
    if (clickNavInstalled) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    clickNavInstalled = true;
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        const data = event.data;
        if (data && data.type === "notification-click" && typeof data.url === "string") {
            try {
                const u = new URL(data.url, window.location.origin);
                window.location.assign(u.pathname + u.search + u.hash);
            } catch {
                // Malformed URL — ignore rather than navigate somewhere wrong.
            }
        }
    });
};
