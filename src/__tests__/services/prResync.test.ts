/**
 * MIP-1409. The signal and the clock behind the PR column's re-sync: what asks, how often, and
 * when it holds back. A poll is a GitHub call per matching branch, so most of these are about
 * the clock NOT firing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    _resetPrResyncForTests,
    getPrResyncRequest,
    PR_RESYNC_INTERVAL_MS,
    PR_RESYNC_MANUAL_COOLDOWN_MS,
    reportPrResyncOutcome,
    requestPrResync,
    subscribePrResync,
} from "../../features/integrations/services/prResync";

const MIN = PR_RESYNC_INTERVAL_MS;

const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
};
const setOnline = (online: boolean) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
};

/** The reasons seen so far, in order. */
const watch = () => {
    const seen: string[] = [];
    const unsubscribe = subscribePrResync(() => seen.push(getPrResyncRequest().reason));
    return { seen, unsubscribe };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T09:00:00Z"));
    _resetPrResyncForTests();
    setHidden(false);
    setOnline(true);
});

afterEach(() => {
    _resetPrResyncForTests();
    vi.useRealTimers();
});

describe("the once-a-minute clock", () => {
    it("polls once a minute while a cell is subscribed", () => {
        const { seen } = watch();
        vi.advanceTimersByTime(MIN - 1);
        expect(seen).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(seen).toEqual(["poll"]);
        vi.advanceTimersByTime(MIN);
        expect(seen).toEqual(["poll", "poll"]);
    });

    it("does not run at all with no subscriber", () => {
        vi.advanceTimersByTime(10 * MIN);
        expect(getPrResyncRequest().id).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("stops with the last subscriber, and a second one does not start a second clock", () => {
        const a = watch();
        const b = watch();
        expect(vi.getTimerCount()).toBe(1);
        a.unsubscribe();
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(MIN);
        expect(b.seen).toEqual(["poll"]);
        b.unsubscribe();
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(5 * MIN);
        expect(getPrResyncRequest().id).toBe(1);
    });

    it("skips a tick while the tab is hidden", () => {
        const { seen } = watch();
        setHidden(true);
        vi.advanceTimersByTime(3 * MIN);
        expect(seen).toEqual([]);
    });

    it("skips a tick while the browser is offline", () => {
        const { seen } = watch();
        setOnline(false);
        vi.advanceTimersByTime(3 * MIN);
        expect(seen).toEqual([]);
    });

    it("catches up at once when the tab comes back after a minute or more", () => {
        const { seen } = watch();
        setHidden(true);
        vi.advanceTimersByTime(3 * MIN);
        setHidden(false);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(seen).toEqual(["poll"]);
    });

    it("does not catch up when the tab comes back within the minute", () => {
        const { seen } = watch();
        // 40 s: past the half-minute a poll holds back after a sync, so only "a minute or more"
        // can be what keeps this from polling.
        vi.advanceTimersByTime(40_000);
        setHidden(true);
        document.dispatchEvent(new Event("visibilitychange"));
        setHidden(false);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(seen).toEqual([]);
    });

    it("catches up when the browser goes back online after a minute or more", () => {
        const { seen } = watch();
        setOnline(false);
        vi.advanceTimersByTime(3 * MIN);
        expect(seen).toEqual([]);
        setOnline(true);
        window.dispatchEvent(new Event("online"));
        expect(seen).toEqual(["poll"]);
    });

    it("counts the cells' own first load as a sync: the first visibility change does not poll", () => {
        const { seen } = watch();
        document.dispatchEvent(new Event("visibilitychange"));
        expect(seen).toEqual([]);
    });

    it("stops listening for visibility with the last subscriber", () => {
        const a = watch();
        a.unsubscribe();
        vi.advanceTimersByTime(3 * MIN);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(getPrResyncRequest().id).toBe(0);
    });
});

describe("a click (manual)", () => {
    it("asks at once, whatever the clock says", () => {
        const { seen } = watch();
        expect(requestPrResync("manual")).toBe(true);
        expect(seen).toEqual(["manual"]);
        expect(getPrResyncRequest()).toEqual({ id: 1, reason: "manual" });
    });

    it("ignores a second click within the cooldown, and obeys one after it", () => {
        const { seen } = watch();
        expect(requestPrResync("manual")).toBe(true);
        vi.advanceTimersByTime(PR_RESYNC_MANUAL_COOLDOWN_MS - 1);
        expect(requestPrResync("manual")).toBe(false);
        expect(seen).toEqual(["manual"]);
        vi.advanceTimersByTime(1);
        expect(requestPrResync("manual")).toBe(true);
        expect(seen).toEqual(["manual", "manual"]);
    });

    it("is not held back by being hidden or offline (it is the user, so the tab is theirs)", () => {
        const { seen } = watch();
        setHidden(true);
        setOnline(false);
        expect(requestPrResync("manual")).toBe(true);
        expect(seen).toEqual(["manual"]);
    });

    it("pushes the next poll back: a poll does not follow a click within half a minute", () => {
        const { seen } = watch();
        vi.advanceTimersByTime(MIN - 10_000); // 10 s before the first tick
        requestPrResync("manual");
        vi.advanceTimersByTime(10_000); // the tick: only 10 s after the click
        expect(seen).toEqual(["manual"]);
        vi.advanceTimersByTime(MIN); // the next one is a full minute on
        expect(seen).toEqual(["manual", "poll"]);
    });
});

describe("after a failed poll", () => {
    const pollOnce = (seen: string[]) => {
        vi.advanceTimersByTime(MIN);
        expect(seen.at(-1)).toBe("poll");
        return getPrResyncRequest().id;
    };

    it("waits 2 minutes, then polls again", () => {
        const { seen } = watch();
        reportPrResyncOutcome(pollOnce(seen), false);
        const before = seen.length;

        vi.advanceTimersByTime(MIN); // 1 min after the failure: held back
        expect(seen.length).toBe(before);
        vi.advanceTimersByTime(MIN); // 2 min after it: allowed
        expect(seen.length).toBe(before + 1);
    });

    it("waits longer after each failure, up to 8 minutes", () => {
        const { seen } = watch();
        reportPrResyncOutcome(pollOnce(seen), false); // wait 2
        vi.advanceTimersByTime(2 * MIN);
        reportPrResyncOutcome(getPrResyncRequest().id, false); // wait 4
        const n = seen.length;
        vi.advanceTimersByTime(3 * MIN);
        expect(seen.length).toBe(n);
        vi.advanceTimersByTime(MIN);
        expect(seen.length).toBe(n + 1);

        reportPrResyncOutcome(getPrResyncRequest().id, false); // wait 8
        reportPrResyncOutcome(1, false); // an old id changes nothing
        const m = seen.length;
        vi.advanceTimersByTime(7 * MIN);
        expect(seen.length).toBe(m);
        vi.advanceTimersByTime(MIN);
        expect(seen.length).toBe(m + 1);

        reportPrResyncOutcome(getPrResyncRequest().id, false); // capped: still 8
        const k = seen.length;
        vi.advanceTimersByTime(8 * MIN);
        expect(seen.length).toBe(k + 1);
    });

    it("one success puts the clock back at a minute", () => {
        const { seen } = watch();
        reportPrResyncOutcome(pollOnce(seen), false);
        vi.advanceTimersByTime(2 * MIN);
        reportPrResyncOutcome(getPrResyncRequest().id, true);
        const n = seen.length;
        vi.advanceTimersByTime(MIN);
        expect(seen.length).toBe(n + 1);
    });

    it("counts one request once, however many cells report it", () => {
        const { seen } = watch();
        const id = pollOnce(seen);
        // Forty rows share one batched GET: forty failures are one failure.
        for (let i = 0; i < 40; i++) reportPrResyncOutcome(id, false);
        const n = seen.length;
        vi.advanceTimersByTime(2 * MIN);
        expect(seen.length).toBe(n + 1);
    });

    it("a late report for a request a newer one has replaced changes nothing", () => {
        const { seen } = watch();
        vi.advanceTimersByTime(MIN); // poll #1, never reported
        const first = getPrResyncRequest().id;
        vi.advanceTimersByTime(MIN); // poll #2 replaces it
        reportPrResyncOutcome(first, false);
        const n = seen.length;
        vi.advanceTimersByTime(MIN);
        expect(seen.length).toBe(n + 1);
    });

    it("a failure after a success waits the short time again: the success reset the count", () => {
        const { seen } = watch();
        reportPrResyncOutcome(pollOnce(seen), false); // wait 2
        vi.advanceTimersByTime(2 * MIN);
        reportPrResyncOutcome(getPrResyncRequest().id, true); // reset
        vi.advanceTimersByTime(MIN);
        reportPrResyncOutcome(getPrResyncRequest().id, false); // 2 again, not 4
        const n = seen.length;
        vi.advanceTimersByTime(2 * MIN);
        expect(seen.length).toBe(n + 1);
    });

    it("a click lifts the backoff", () => {
        const { seen } = watch();
        reportPrResyncOutcome(pollOnce(seen), false);
        requestPrResync("manual");
        reportPrResyncOutcome(getPrResyncRequest().id, false); // a click's outcome is not a poll's
        const n = seen.length;
        vi.advanceTimersByTime(MIN);
        expect(seen.length).toBe(n + 1);
    });

    it("a failed click does not slow the poll", () => {
        const { seen } = watch();
        requestPrResync("manual");
        reportPrResyncOutcome(getPrResyncRequest().id, false);
        vi.advanceTimersByTime(MIN);
        expect(seen).toEqual(["manual", "poll"]);
    });
});
