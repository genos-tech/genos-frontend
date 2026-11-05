import { useEffect, useRef } from "react";

/**
 * Mirror the unread count onto the installed app's icon (the little
 * counter chip on the home screen / dock).
 *
 * Uses the Badging API, which only does anything for an *installed* PWA:
 * iOS 16.4+ (where it also requires notification permission, already
 * granted for push), plus desktop Chrome/Edge. In a normal browser tab
 * the calls are absent or no-op, so this is safe to run everywhere.
 *
 * Two writers share the icon, and the rule that keeps them from fighting
 * is "whoever is on screen owns it":
 *
 *   * The service worker sets it on a push while the app is away (that is
 *     what keeps the number moving when the app isn't running). It leaves
 *     the icon alone while a window is visible (`public/sw.js`).
 *   * This hook owns it while the app is open, because its own counts are
 *     the more accurate source.
 *
 * The hook therefore has to write in two situations, not one:
 *
 *   1. The count changed. The effect below, keyed on the count, so an
 *      ordinary re-render with the same number does not call the API.
 *   2. The app came back. The worker may have put the SERVER's number on
 *      the icon while the page was away, and the page's own count did not
 *      change in the meantime (it never moved, so effect 1 never fires).
 *      Without this the wrong number stayed until something unrelated
 *      happened to move the count, which is what made a new notification
 *      look like it "fixed" the badge. Returning to the app is signalled
 *      by `visibilitychange`, plus `pageshow` (a page restored from the
 *      back/forward cache) and `focus` (desktop PWAs, which can regain
 *      focus without a visibility change).
 */

type BadgeNavigator = Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

/** Put `count` on the icon: 0 clears it, anything else sets it. No-ops where
 *  the Badging API is absent. */
const writeBadge = (count: number): void => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;

    // A rejected promise here is never actionable (unsupported
    // surface, or permission revoked mid-session) and must not
    // surface as an unhandled rejection.
    if (count > 0) {
        void nav.setAppBadge(count).catch(() => {});
    } else {
        void (nav.clearAppBadge?.() ?? nav.setAppBadge(0)).catch(() => {});
    }
};

export const useAppBadge = (unreadCount: number): void => {
    // The latest count, for the listeners below. They are bound once, so they
    // can't close over `unreadCount` without going stale on the first change.
    // Written inside the effect (not during render) so a render React throws
    // away can't leave a count here that was never put on the icon.
    const latestCount = useRef(unreadCount);

    // (1) The count changed. Also runs on mount, which is the first write.
    useEffect(() => {
        latestCount.current = unreadCount;
        writeBadge(unreadCount);
    }, [unreadCount]);

    // (2) The app came back: write again whether or not the count changed.
    useEffect(() => {
        // Only while on screen. A `focus` or `pageshow` that lands while the
        // page is hidden is not a return, and the worker owns the icon then.
        const reapply = () => {
            if (document.visibilityState === "hidden") return;
            writeBadge(latestCount.current);
        };
        document.addEventListener("visibilitychange", reapply);
        window.addEventListener("pageshow", reapply);
        window.addEventListener("focus", reapply);
        return () => {
            document.removeEventListener("visibilitychange", reapply);
            window.removeEventListener("pageshow", reapply);
            window.removeEventListener("focus", reapply);
        };
    }, []);
};
