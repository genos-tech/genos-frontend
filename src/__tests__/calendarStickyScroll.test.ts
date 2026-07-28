/**
 * Horizontal scroll paging the calendar, with a deliberate "stickiness".
 *
 * The whole point is that this must NOT be sensitive. A single trackpad
 * flick emits dozens of wheel events, so a naive one-event-per-step
 * mapping pages through half a year. Three behaviours together prevent
 * that, and each fails differently:
 *
 *  - the distance threshold ("scroll enough" before anything happens);
 *  - the lock after a step, which absorbs trackpad momentum — the tail
 *    of a flick keeps arriving for several hundred ms and would
 *    otherwise immediately trigger a second step;
 *  - the idle reset, which both releases that lock and stops two
 *    unrelated nudges from summing into a step.
 */

import { describe, expect, it } from "vitest";

import {
    advanceSticky,
    horizontalDelta,
    initialStickyState,
    normalizeDelta,
    STICKY_THRESHOLD_PX,
    type StickyScrollState,
} from "../features/calendar/utils/stickyScroll";

/** Feed a series of deltas, collecting every step committed. */
const feed = (deltas: number[], from: StickyScrollState = initialStickyState()) => {
    let state = from;
    const steps: number[] = [];
    for (const d of deltas) {
        const result = advanceSticky(state, d);
        state = result.state;
        if (result.step !== 0) steps.push(result.step);
    }
    return { state, steps };
};

describe("advanceSticky", () => {
    it("does nothing for a small nudge", () => {
        const { steps } = feed([10, 12, -5]);
        expect(steps).toEqual([]);
    });

    it("does not step until the threshold is crossed", () => {
        // One px short must still be nothing — the boundary is where an
        // off-by-one would make this feel twitchy.
        const { steps } = feed([STICKY_THRESHOLD_PX - 1]);
        expect(steps).toEqual([]);
    });

    it("steps forward once the threshold is crossed", () => {
        const { steps } = feed([STICKY_THRESHOLD_PX]);
        expect(steps).toEqual([1]);
    });

    it("accumulates many small deltas into one step", () => {
        // How a real trackpad swipe arrives: dozens of tiny deltas.
        const deltas = new Array(40).fill(5); // 200px total
        const { steps } = feed(deltas);
        expect(steps).toEqual([1]);
    });

    it("steps backward on negative travel", () => {
        const { steps } = feed([-STICKY_THRESHOLD_PX]);
        expect(steps).toEqual([-1]);
    });

    it("locks after a step so momentum can't page again", () => {
        // The tail of a flick: enough travel for several more steps.
        const deltas = [STICKY_THRESHOLD_PX, ...new Array(100).fill(20)];
        const { steps, state } = feed(deltas);
        expect(steps).toEqual([1]);
        expect(state.locked).toBe(true);
    });

    it("stays locked no matter how much more arrives", () => {
        const { steps } = feed(new Array(50).fill(STICKY_THRESHOLD_PX));
        expect(steps).toEqual([1]);
    });

    it("resumes after an idle reset", () => {
        // The reset is what the hook performs once the gesture stops.
        const first = feed([STICKY_THRESHOLD_PX]);
        expect(first.steps).toEqual([1]);

        const second = feed([STICKY_THRESHOLD_PX], initialStickyState());
        expect(second.steps).toEqual([1]);
    });

    it("cancels out when the user scrolls back and forth", () => {
        // Wobble around the origin must not creep toward a step.
        const { steps, state } = feed([60, -60, 50, -50, 40, -40]);
        expect(steps).toEqual([]);
        expect(state.accumulated).toBe(0);
    });

    it("counts reversal correctly rather than by absolute travel", () => {
        // Total distance travelled is well over the threshold, but net
        // displacement is not — this must not step.
        const { steps } = feed([100, -100, 100, -100]);
        expect(steps).toEqual([]);
    });

    it("clears the accumulator when it steps", () => {
        const { state } = feed([STICKY_THRESHOLD_PX + 500]);
        expect(state.accumulated).toBe(0);
    });
});

describe("normalizeDelta", () => {
    it("passes pixel deltas through", () => {
        expect(normalizeDelta(120, 0)).toBe(120);
    });

    it("scales up line-mode deltas", () => {
        // Firefox reports lines (deltaY of 3 per notch). Untreated, the
        // same gesture is ~16x weaker there and the feature reads as
        // broken rather than differently tuned.
        expect(normalizeDelta(3, 1)).toBe(48);
    });

    it("scales up page-mode deltas", () => {
        expect(normalizeDelta(1, 2)).toBe(100);
    });
});

describe("horizontalDelta", () => {
    const wheel = (over: Partial<Parameters<typeof horizontalDelta>[0]>) => ({
        deltaX: 0,
        deltaY: 0,
        deltaMode: 0,
        shiftKey: false,
        ...over,
    });

    it("reads a sideways trackpad swipe", () => {
        expect(horizontalDelta(wheel({ deltaX: 40, deltaY: 2 }))).toBe(40);
    });

    it("ignores a vertical gesture", () => {
        // Must stay null or we'd hijack scrolling the timeline's hour
        // grid and the month grid's overflow.
        expect(horizontalDelta(wheel({ deltaX: 2, deltaY: 40 }))).toBeNull();
    });

    it("ignores a diagonal gesture that's mostly vertical", () => {
        // Trackpad gestures are never perfectly axis-aligned; treating
        // any sideways component as horizontal would make vertical
        // scrolling page the calendar at random.
        expect(horizontalDelta(wheel({ deltaX: 20, deltaY: 30 }))).toBeNull();
    });

    it("treats shift + wheel as horizontal", () => {
        // The long-standing convention for horizontal scroll on a plain
        // mouse, which has no deltaX at all.
        expect(horizontalDelta(wheel({ deltaY: 100, shiftKey: true }))).toBe(100);
    });

    it("normalizes units for shift + wheel too", () => {
        expect(horizontalDelta(wheel({ deltaY: 3, deltaMode: 1, shiftKey: true }))).toBe(48);
    });

    it("returns null for a wheel event with no movement", () => {
        expect(horizontalDelta(wheel({}))).toBeNull();
        expect(horizontalDelta(wheel({ shiftKey: true }))).toBeNull();
    });

    it("normalizes line-mode horizontal deltas", () => {
        expect(horizontalDelta(wheel({ deltaX: 3, deltaY: 0, deltaMode: 1 }))).toBe(48);
    });
});

describe("threshold feel", () => {
    it("takes a deliberate swipe, not a flick, to page", () => {
        // Guards the tuning itself: a tiny incidental sideways drift
        // during vertical scrolling (a handful of px) must never page,
        // while a real swipe (a few hundred px) must.
        expect(feed([8, 6, 9]).steps).toEqual([]);
        expect(feed(new Array(30).fill(10)).steps).toEqual([1]);
    });
});
