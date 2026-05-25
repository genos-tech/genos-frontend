import { useEffect, useRef } from "react";

// Fires `onWake` when the user "comes back" to the app — either the tab
// became visible after being hidden for at least `idleThresholdMs`, or
// the browser regained network connectivity after an offline stretch.
//
// Background: data is loaded into IndexedDB once at boot via
// `loadInitialData`, then kept fresh by WebSocket deltas. If the laptop
// sleeps for hours / days the tab survives but the WS misses everything
// that happened while offline, and the boot loaders never re-fire (their
// deps `[myself, accessToken]` don't change). IDB rots silently. This
// hook gives the app a single signal to repull from the API on wake.
//
// `idleThresholdMs` filters out cheap tab switches (Cmd-Tab back to the
// tab after 5s shouldn't burn an API call). Default 2 min matches the
// "real sleep" / "stepped away" threshold.

interface UseWakeRefreshOptions {
    idleThresholdMs?: number;
}

const DEFAULT_IDLE_THRESHOLD_MS = 10 * 60 * 1000;

export const useWakeRefresh = (
    onWake: () => void | Promise<void>,
    options: UseWakeRefreshOptions = {}
): void => {
    const { idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS } = options;

    // Stash the latest callback in a ref so the event listeners don't
    // re-bind every time the parent re-renders with a fresh arrow.
    const onWakeRef = useRef(onWake);
    useEffect(() => {
        onWakeRef.current = onWake;
    }, [onWake]);

    useEffect(() => {
        // Timestamp of the most recent hidden→visible transition or
        // offline→online transition. Used both to gate the idle threshold
        // and to debounce two near-simultaneous signals (e.g. lid open
        // fires both `visibilitychange` AND `online` within a few hundred
        // ms) into one refresh.
        let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
        let lastFiredAt = 0;
        const REFIRE_DEBOUNCE_MS = 5000;

        const tryFire = () => {
            const now = Date.now();
            if (now - lastFiredAt < REFIRE_DEBOUNCE_MS) return;
            lastFiredAt = now;
            try {
                void onWakeRef.current();
            } catch (err) {
                console.error("[useWakeRefresh] onWake threw", err);
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
                return;
            }
            // visible
            const idle = hiddenAt != null ? Date.now() - hiddenAt : 0;
            hiddenAt = null;
            if (idle >= idleThresholdMs) {
                tryFire();
            }
        };

        const onOnline = () => {
            // Network restored — refetch unconditionally. Going offline
            // even briefly means we may have missed WS deltas.
            tryFire();
        };

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("online", onOnline);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("online", onOnline);
        };
    }, [idleThresholdMs]);
};
