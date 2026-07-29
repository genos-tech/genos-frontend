import { useEffect } from "react";

/**
 * Mirror the unread count onto the installed app's icon (the little
 * counter chip on the home screen / dock).
 *
 * Uses the Badging API, which only does anything for an *installed* PWA:
 * iOS 16.4+ (where it also requires notification permission, already
 * granted for push), plus desktop Chrome/Edge. In a normal browser tab
 * the calls are absent or no-op, so this is safe to run everywhere.
 *
 * The service worker sets the badge too, on push receipt — that's what
 * keeps the number moving while the app isn't running. This hook owns
 * the foreground half: whenever the app is open, its own counts are the
 * more accurate source, so it overwrites whatever the worker last set.
 */

type BadgeNavigator = Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

export const useAppBadge = (unreadCount: number): void => {
    useEffect(() => {
        if (typeof navigator === "undefined") return;
        const nav = navigator as BadgeNavigator;
        if (typeof nav.setAppBadge !== "function") return;

        // A rejected promise here is never actionable (unsupported
        // surface, or permission revoked mid-session) and must not
        // surface as an unhandled rejection.
        if (unreadCount > 0) {
            void nav.setAppBadge(unreadCount).catch(() => {});
        } else {
            void (nav.clearAppBadge?.() ?? nav.setAppBadge(0)).catch(() => {});
        }
    }, [unreadCount]);
};
