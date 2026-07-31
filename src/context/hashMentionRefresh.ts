/**
 * Throttle for the `#`-mention data refresh.
 *
 * The refresh is fired from hot paths — every keystroke of a `#` query,
 * every window focus, from whichever editors happen to be mounted — so
 * the throttle is what makes those call sites safe to write naively. It
 * collapses a burst to at most one run per interval, and (unlike a
 * debounce) runs the FIRST call immediately: the point is to have fresh
 * data by the time the user finishes typing a name, so delaying the
 * fetch would defeat it.
 */

/** At most one `#`-data refetch per 30s across the whole app. */
export const HASH_MENTION_REFRESH_INTERVAL_MS = 30_000;

/**
 * How often to re-pull the lists while the tab is VISIBLE.
 *
 * `focus` alone only fires on a blur→focus round trip, so someone who
 * simply leaves the app open never picks up a teammate's new note. This
 * is the fallback tick for that case — deliberately slower than the
 * throttle above (so it can never be the thing that saturates it) and
 * paused while the tab is hidden.
 */
export const NOTE_LIST_POLL_MS = 60_000;

export type ThrottledRefresh = (() => void) & {
    /** Test seam — drops the throttle so the next call runs. */
    reset: () => void;
};

export const createThrottledRefresh = (
    run: () => void,
    intervalMs: number = HASH_MENTION_REFRESH_INTERVAL_MS,
    now: () => number = Date.now
): ThrottledRefresh => {
    let lastRunAt: number | null = null;
    const throttled = () => {
        const t = now();
        if (lastRunAt !== null && t - lastRunAt < intervalMs) return;
        lastRunAt = t;
        run();
    };
    throttled.reset = () => {
        lastRunAt = null;
    };
    return throttled;
};
