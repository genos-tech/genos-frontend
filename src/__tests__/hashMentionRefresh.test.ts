/**
 * Throttle behind the `#`-mention data refresh.
 *
 * The call sites are hot — one call per `#` keystroke, per window focus,
 * from every mounted editor — so the throttle is what lets them stay
 * naive. Two properties matter: the FIRST call runs immediately (the
 * whole point is fresh data by the time the user finishes typing a name,
 * so a debounce would defeat it), and a burst collapses to one run.
 */

import { describe, expect, it, vi } from "vitest";

import {
    createThrottledRefresh,
    HASH_MENTION_REFRESH_INTERVAL_MS,
} from "../context/hashMentionRefresh";

/** Controllable clock so the test doesn't wait 30 real seconds. */
const fakeClock = (start = 1_000) => {
    let t = start;
    return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("createThrottledRefresh", () => {
    it("runs the first call immediately", () => {
        const run = vi.fn();
        const clock = fakeClock();
        createThrottledRefresh(run, 1000, clock.now)();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("collapses a burst to a single run", () => {
        const run = vi.fn();
        const clock = fakeClock();
        const refresh = createThrottledRefresh(run, 1000, clock.now);

        // Every keystroke of "#design" plus a couple of focus events.
        for (let i = 0; i < 10; i++) refresh();

        expect(run).toHaveBeenCalledTimes(1);
    });

    it("runs again once the interval has passed", () => {
        const run = vi.fn();
        const clock = fakeClock();
        const refresh = createThrottledRefresh(run, 1000, clock.now);

        refresh();
        clock.advance(999);
        refresh();
        expect(run).toHaveBeenCalledTimes(1);

        clock.advance(1);
        refresh();
        expect(run).toHaveBeenCalledTimes(2);
    });

    it("defaults to the app-wide interval", () => {
        const run = vi.fn();
        const clock = fakeClock();
        const refresh = createThrottledRefresh(run, undefined, clock.now);

        refresh();
        clock.advance(HASH_MENTION_REFRESH_INTERVAL_MS - 1);
        refresh();
        expect(run).toHaveBeenCalledTimes(1);

        clock.advance(1);
        refresh();
        expect(run).toHaveBeenCalledTimes(2);
    });

    it("always calls through to the CURRENT implementation", () => {
        // The App wires this over a ref so the stable throttled function
        // never runs a stale render's loaders.
        let impl = vi.fn();
        const clock = fakeClock();
        const refresh = createThrottledRefresh(() => impl(), 1000, clock.now);

        refresh();
        expect(impl).toHaveBeenCalledTimes(1);

        const next = vi.fn();
        impl = next;
        clock.advance(1000);
        refresh();
        expect(next).toHaveBeenCalledTimes(1);
    });
});
