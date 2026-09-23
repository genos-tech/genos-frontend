import { useEffect, useRef, useState } from "react";

// Full page reload after a long idle stretch — the blunt-instrument
// companion to `useWakeRefresh`.
//
// `useWakeRefresh` re-pulls the API into IDB on wake, which fixes stale
// DATA. It cannot fix a stale PROCESS: after a laptop sleeps overnight the
// tab comes back with timers that never fired, a socket whose reconnect
// backoff gave up, React state built against a since-deployed bundle, and
// module-level caches nobody re-primes. That's the class of "the app acts
// weird until I hit reload" this hook closes, by doing exactly what the
// user would have done manually.
//
// Two independent triggers, because neither alone covers the real cases:
//
//   * SUSPEND GAP (the important one). macOS closing the lid often does
//     NOT fire `visibilitychange` — the page stays `visible` while the
//     machine suspends, so every listener-based scheme sleeps through it.
//     What is always observable is that our heartbeat interval did not
//     run: a tick that lands `threshold` after the previous one proves the
//     page was frozen that long. This latches (`staleRef`) — once a gap
//     that size is observed the page IS stale, and later user activity
//     can't argue otherwise. Latching matters because the resumed tick
//     and the user's first click race, and the click must not win.
//
//   * PLAIN INACTIVITY — machine awake, nobody touched the page for
//     `threshold`. Cleared by any real interaction, so it only ever fires
//     for a genuinely abandoned tab.
//
// The reload waits for `visible` + online and announces itself with a
// short grace window (the caller renders a snackbar off `reloadPending`),
// so the page flashing reads as intentional rather than as a crash.
// Reloading while offline is specifically avoided: with no network a
// reload can land on the browser's error page and take the running SPA
// with it.
//
// `isBusy` is the other hard veto, and the reason this hook takes a
// callback rather than just a duration. This app has no `beforeunload`
// handler anywhere, so a reload destroys in-flight work silently: a
// streaming Genos answer is NOT resumable (only COMPLETED turns reach
// localStorage), staged file attachments are raw `File` objects that no
// draft store can serialize, and an agent approval waiting on the user
// leaves a dangling backend run. Losing any of those to an automatic
// reload would be a worse bug than the stale page this fixes, so a busy
// page defers indefinitely and re-checks on the heartbeat.
//
// Loop safety, which any self-reloading page has to earn:
//   * `lastActivityRef` starts at mount and is deliberately NOT persisted,
//     so a fresh page always begins with a zeroed idle clock.
//   * a reload stamps `sessionStorage`, and a stamp newer than
//     `RELOAD_COOLDOWN_MS` blocks the next one — so even a pathological
//     "instantly stale on boot" state degrades to one reload per cooldown
//     instead of a reload loop.

interface UseIdleAutoReloadOptions {
    /** Idle time that makes the page stale. Default 12h. */
    idleThresholdMs?: number;
    /** Snackbar lead time before the reload. Default 2s. */
    graceMs?: number;
    /** Set false to disarm (e.g. before auth settles). Default true. */
    enabled?: boolean;
    /**
     * Veto for work a reload would destroy. Polled at decision time (not
     * subscribed), so it must read live values — pass a callback reading
     * refs/state, not a boolean captured at render.
     */
    isBusy?: () => boolean;
}

const DEFAULT_IDLE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
const DEFAULT_GRACE_MS = 2000;

// Background tabs get timers throttled to roughly once a minute, so a
// 60s heartbeat is the shortest interval that isn't already fighting the
// browser. Resolution only bounds how soon after a resume we notice.
const HEARTBEAT_MS = 60 * 1000;

// A tick this late means the page was frozen rather than merely throttled.
const SUSPEND_GAP_MS = 2 * HEARTBEAT_MS;

// Floor for the cooldown below, so a deliberately small threshold (tests,
// a tuned-down config) still can't produce rapid reloads.
const MIN_RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_RELOAD_KEY = "genos-idle-auto-reload-at";

// One auto-reload per threshold window. A freshly loaded page cannot
// legitimately go stale again faster than `idleThresholdMs` — both paths to
// staleness need that much wall clock — so this can never block a reload
// the user actually needed, and it caps the damage if the clock itself is
// the thing misbehaving (an NTP jump forward reads exactly like a long
// suspend, and a machine doing that repeatedly would otherwise reload
// repeatedly).
const cooldownFor = (idleThresholdMs: number): number =>
    Math.max(idleThresholdMs, MIN_RELOAD_COOLDOWN_MS);

// `visibilitychange` / `focus` are NOT here on purpose: coming back to the
// tab is the moment we want to reload ON, so counting it as activity would
// reset the very clock we're reading. These are all passive.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

const readLastReloadAt = (): number => {
    try {
        return Number(window.sessionStorage.getItem(LAST_RELOAD_KEY)) || 0;
    } catch {
        // Private mode / blocked storage. Falling back to 0 keeps the
        // feature working and only gives up the cooldown.
        return 0;
    }
};

const stampReload = (): void => {
    try {
        window.sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    } catch {
        // See above — a missing stamp costs the cooldown, not correctness.
    }
};

/**
 * Reloads the page once it has been idle for `idleThresholdMs`.
 *
 * @returns `true` while the reload is announced but not yet performed, for
 *          the caller to render its "refreshing" snackbar from.
 */
export const useIdleAutoReload = (options: UseIdleAutoReloadOptions = {}): boolean => {
    const {
        idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
        graceMs = DEFAULT_GRACE_MS,
        enabled = true,
        isBusy,
    } = options;

    const [reloadPending, setReloadPending] = useState(false);

    // Mirrors `reloadPending` for the listeners, which close over the
    // effect's first render and can't read the state value.
    const pendingRef = useRef(false);

    // Callers pass a fresh arrow every render; a ref keeps the listeners
    // bound once while still calling the CURRENT predicate.
    const isBusyRef = useRef(isBusy);
    isBusyRef.current = isBusy;

    useEffect(() => {
        if (!enabled) return;

        let lastActivityAt = Date.now();
        let lastTickAt = Date.now();
        // Latched by the suspend-gap detector; see the header comment for
        // why user activity must not be able to clear it.
        let suspended = false;
        let graceTimer: ReturnType<typeof setTimeout> | null = null;

        const isStale = () => suspended || Date.now() - lastActivityAt >= idleThresholdMs;

        // A throwing predicate must not take the app down, and must not
        // read as "idle" either — treat a broken check as busy and skip
        // this round.
        const busy = () => {
            try {
                return isBusyRef.current?.() === true;
            } catch (err) {
                console.error("[useIdleAutoReload] isBusy threw", err);
                return true;
            }
        };

        const markActive = () => {
            lastActivityAt = Date.now();
        };

        const reloadNow = () => {
            graceTimer = null;
            // Re-check: during the grace window the user may have started
            // typing (inactivity path), kicked off an upload, or the
            // network may have dropped. A latched suspend can't be talked
            // out of — that page really did miss hours — but it still
            // waits for a usable network and an idle app.
            if (!isStale() || !navigator.onLine || busy()) {
                pendingRef.current = false;
                setReloadPending(false);
                return;
            }
            stampReload();
            window.location.reload();
        };

        const maybeReload = () => {
            if (pendingRef.current) return;
            if (!isStale()) return;
            // Hold until the user is actually looking: the snackbar is the
            // whole reason the flash doesn't read as a bug, and a hidden
            // tab has nobody to show it to. The heartbeat re-checks, and
            // `visibilitychange` fires the moment they return.
            if (document.visibilityState !== "visible") return;
            if (!navigator.onLine) return;
            // Deferred, not cancelled: staleness stays latched and the
            // heartbeat retries once the work finishes.
            if (busy()) return;
            if (Date.now() - readLastReloadAt() < cooldownFor(idleThresholdMs)) return;

            pendingRef.current = true;
            setReloadPending(true);
            graceTimer = setTimeout(reloadNow, graceMs);
        };

        const onHeartbeat = () => {
            const now = Date.now();
            const gap = now - lastTickAt;
            lastTickAt = now;
            // A gap proves the page was frozen, but only a gap at least as
            // long as the threshold means it went stale — a 10-minute
            // suspend is a closed lid over lunch, not an overnight one.
            // `SUSPEND_GAP_MS` is the floor that keeps ordinary background
            // throttling from ever counting as a freeze.
            if (gap >= Math.max(SUSPEND_GAP_MS, idleThresholdMs)) {
                suspended = true;
            }
            maybeReload();
        };

        const heartbeat = setInterval(onHeartbeat, HEARTBEAT_MS);
        for (const event of ACTIVITY_EVENTS) {
            window.addEventListener(event, markActive, { passive: true });
        }
        document.addEventListener("visibilitychange", maybeReload);
        window.addEventListener("focus", maybeReload);
        // Coming back online is both a plausible resume signal and the
        // unblock for a reload `maybeReload` refused while offline.
        window.addEventListener("online", maybeReload);

        return () => {
            clearInterval(heartbeat);
            if (graceTimer) clearTimeout(graceTimer);
            for (const event of ACTIVITY_EVENTS) {
                window.removeEventListener(event, markActive);
            }
            document.removeEventListener("visibilitychange", maybeReload);
            window.removeEventListener("focus", maybeReload);
            window.removeEventListener("online", maybeReload);
            pendingRef.current = false;
        };
    }, [enabled, idleThresholdMs, graceMs]);

    return reloadPending;
};
