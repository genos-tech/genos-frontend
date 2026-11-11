// When the task table's PR column asks GitHub again (MIP-1409).
//
// Before this the column asked once per row mount and never again: a PR that merged, or a CI
// run that finished, showed its old state until the table was re-opened. Two things ask now:
//
//   "manual"  the Refresh tasks button. Every row, and the server is told to skip its own
//             cache too (`fresh=1`): the click wants the authoritative answer.
//   "poll"    about once a minute while a PR cell is on screen. Only rows that still show an
//             open or draft PR take part (a merged or closed one is final, and a row with no
//             PR has nothing to follow), and the server's cache is left in place. The table
//             is not virtualised, so every row of the open project mounts a cell: asking for
//             all of them each minute would be a GitHub call per matching branch per minute,
//             per open tab, against a quota of about 5,000 an hour.
//
// This module is only the signal and the clock. It knows nothing about rows: a cell reads the
// latest request (`usePrResyncRequest`), decides whether it takes part, and asks the
// loaders in `github.ts` / `prStatusCache.ts`.
//
// The clock runs only while a cell is mounted (the first subscriber starts it, the last one
// stops it), skips a tick while the tab is hidden or the browser is offline, catches up when
// the tab comes back after a minute or more, and slows down after a failed poll.

export type PrResyncReason = "manual" | "poll";

export type PrResyncRequest = { readonly id: number; readonly reason: PrResyncReason };

export const PR_RESYNC_INTERVAL_MS = 60_000;
/** A second click within this window is ignored: each one is a `fresh=1` GitHub walk. */
export const PR_RESYNC_MANUAL_COOLDOWN_MS = 5_000;
/** After a failed poll the clock waits 2, 4, then 8 minutes; one success or click resets it. */
const MAX_BACKOFF_STEPS = 3;
/** A timer fires a hair early now and then; do not count that as "still backing off". */
const TICK_SLACK_MS = 1_000;

const NONE: PrResyncRequest = { id: 0, reason: "poll" };

let latest: PrResyncRequest = NONE;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

// Wall-clock times (`Date.now()`), not timer counts: a laptop that slept does not fire the
// missed ticks, and the next real one has to be judged by how long ago the last sync was.
let lastRequestAt = 0;
let lastManualAt = Number.NEGATIVE_INFINITY;
let failures = 0;
let resumeAt = 0;
let lastReportedId = 0;

const hidden = (): boolean => typeof document !== "undefined" && document.hidden;
const offline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Ask every mounted PR cell to re-sync. Returns false when a manual request was dropped for
 * coming too soon after the last one.
 */
export const requestPrResync = (reason: PrResyncReason): boolean => {
    const now = Date.now();
    if (reason === "manual") {
        if (now - lastManualAt < PR_RESYNC_MANUAL_COOLDOWN_MS) return false;
        lastManualAt = now;
        // The user asked: a backed-off clock is no reason to refuse.
        failures = 0;
        resumeAt = 0;
    }
    lastRequestAt = now;
    latest = { id: latest.id + 1, reason };
    for (const listener of [...listeners]) listener();
    return true;
};

/**
 * A cell reports how the poll it took part in went. The first report for a request counts
 * (one request is one batched GET, so every cell sees the same outcome). A success resets the
 * clock; a failure makes it wait longer before the next poll.
 */
export const reportPrResyncOutcome = (requestId: number, ok: boolean): void => {
    if (requestId !== latest.id || requestId === lastReportedId) return;
    lastReportedId = requestId;
    if (latest.reason !== "poll") return;
    if (ok) {
        failures = 0;
        resumeAt = 0;
        return;
    }
    failures = Math.min(failures + 1, MAX_BACKOFF_STEPS);
    resumeAt = Date.now() + PR_RESYNC_INTERVAL_MS * 2 ** failures;
};

const tick = (): void => {
    if (hidden() || offline()) return;
    const now = Date.now();
    if (now + TICK_SLACK_MS < resumeAt) return;
    // A click or a catch-up just synced everything; do not follow it with a poll.
    if (now - lastRequestAt < PR_RESYNC_INTERVAL_MS / 2) return;
    requestPrResync("poll");
};

// The tab came back, or the browser went online again, after a minute or more: do not wait
// for the next tick. (A closed laptop lid often fires neither event; there the interval
// resuming after wake does the same job, one tick later.)
const catchUp = (): void => {
    if (Date.now() - lastRequestAt >= PR_RESYNC_INTERVAL_MS) tick();
};

const start = (): void => {
    // The cells' own first load is a sync: count it, or the first visibility change would
    // "catch up" on a minute that never passed.
    lastRequestAt = Date.now();
    failures = 0;
    resumeAt = 0;
    timer = setInterval(tick, PR_RESYNC_INTERVAL_MS);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", catchUp);
    if (typeof window !== "undefined") window.addEventListener("online", catchUp);
};

const stop = (): void => {
    if (timer != null) clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", catchUp);
    if (typeof window !== "undefined") window.removeEventListener("online", catchUp);
};

/** Subscribe a cell. The first subscriber starts the clock, the last one stops it. */
export const subscribePrResync = (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (listeners.size === 1) start();
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
    };
};

export const getPrResyncRequest = (): PrResyncRequest => latest;

/** Test seam: forget every request, listener and timer so one test cannot leak into the next. */
export const _resetPrResyncForTests = (): void => {
    stop();
    listeners.clear();
    latest = NONE;
    lastRequestAt = 0;
    lastManualAt = Number.NEGATIVE_INFINITY;
    failures = 0;
    resumeAt = 0;
    lastReportedId = 0;
};
