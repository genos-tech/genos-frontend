/**
 * MIP-968: the timing of a task-row click.
 *
 * Clicking a row used to wait 150 ms before it loaded anything, even for a
 * single, ordinary click. The wait exists for the person who clicks through
 * many rows quickly (one load for the row they land on, not one per row), so
 * it now applies only to follow-up clicks:
 *   - a click with no other click in the last `delay` ms loads right after the
 *     next painted frame, not inside the click: the click's own render (the
 *     highlight, the pane) paints first, and the heavy work follows it;
 *   - a second click before that frame supersedes it;
 *   - clicks inside the window collapse to the LAST one, which runs `delay` ms
 *     after it;
 *   - leaving the screen drops whatever is still waiting, the first click too.
 *
 * The fake timers fake `requestAnimationFrame` as well, so a "frame" below is
 * `advance(FRAME)`.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLeadingDebouncedCallback } from "../../hooks/common/useLeadingDebouncedCallback";

const DELAY = 150;
// One frame: the fake clock's 16 ms animation frame, plus the 1 ms it adds to
// the zero-delay timer that is queued from inside that frame's callback.
const FRAME = 17;
const FALLBACK = 100;

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const setup = (delay = DELAY) => {
    const fire = vi.fn<(id: number) => void>();
    const view = renderHook(({ fn }) => useLeadingDebouncedCallback(fn, delay), {
        initialProps: { fn: fire },
    });
    return { fire, view };
};

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const ran = (fire: ReturnType<typeof vi.fn>) => fire.mock.calls.map((c) => c[0]);

describe("useLeadingDebouncedCallback", () => {
    it("a single click does not run inside the click: it runs after one frame, and not again", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));

        // Nothing inside the click itself: its own render has to paint first.
        expect(fire).not.toHaveBeenCalled();
        // Nor inside the animation-frame callback, which runs BEFORE the paint:
        // the work is queued from it as a timer task (the fake clock puts that
        // one 1 ms after the frame).
        advance(FRAME - 1);
        expect(fire).not.toHaveBeenCalled();
        advance(1);
        expect(fire).toHaveBeenCalledTimes(1);
        expect(fire).toHaveBeenCalledWith(1);
        // ...long before the window closes, and not again when it does.
        advance(DELAY * 3);
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("two clicks 50 ms apart: the first runs after its frame, the second after the window", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));

        expect(ran(fire)).toEqual([1]);

        advance(DELAY - 1);
        expect(ran(fire)).toEqual([1]);
        advance(1);
        expect(ran(fire)).toEqual([1, 2]);
    });

    it("a second click before the frame supersedes the first: only the second runs, after the window", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(5); // less than a frame
        act(() => view.result.current.call(2));

        advance(FRAME * 2);
        // The first click never runs.
        expect(fire).not.toHaveBeenCalled();
        advance(DELAY - FRAME * 2 - 1);
        expect(fire).not.toHaveBeenCalled();
        advance(1);
        expect(ran(fire)).toEqual([2]);
    });

    it("five clicks inside one frame run only the last", () => {
        const { fire, view } = setup();

        for (const id of [1, 2, 3, 4, 5]) {
            act(() => view.result.current.call(id));
            advance(2);
        }
        advance(DELAY + FRAME);

        expect(ran(fire)).toEqual([5]);
    });

    it("five rapid clicks (a frame apart) run the first and the last only", () => {
        const { fire, view } = setup();

        for (const id of [1, 2, 3, 4, 5]) {
            act(() => view.result.current.call(id));
            advance(20);
        }
        expect(ran(fire)).toEqual([1]);
        advance(DELAY);

        expect(ran(fire)).toEqual([1, 5]);
    });

    it("every click restarts the window (the last one waits its own full delay)", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(100);
        act(() => view.result.current.call(2));
        advance(100);
        act(() => view.result.current.call(3));
        // 200 ms after click 2, but only 100 after click 3.
        advance(DELAY - 1);
        expect(ran(fire)).toEqual([1]);
        advance(1);
        expect(ran(fire)).toEqual([1, 3]);
    });

    it("a click after a quiet period is a first click again", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));
        advance(DELAY); // click 2 ran
        expect(fire).toHaveBeenCalledTimes(2);

        advance(DELAY);
        act(() => view.result.current.call(3));
        expect(fire).toHaveBeenCalledTimes(2);
        advance(FRAME);
        expect(ran(fire)).toEqual([1, 2, 3]);
    });

    it("the window is measured from the last CLICK: a click as the trailing one runs is a first click", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));
        advance(DELAY); // 2 runs now, 150 ms after click 2
        act(() => view.result.current.call(3));
        advance(FRAME);

        expect(ran(fire)).toEqual([1, 2, 3]);
    });

    it("without a painted frame (hidden tab) the first click runs after the fallback", () => {
        // A hidden tab never fires animation frames.
        vi.stubGlobal("requestAnimationFrame", () => 1);
        vi.stubGlobal("cancelAnimationFrame", () => {});
        const { fire, view } = setup();

        act(() => view.result.current.call(1));

        advance(FRAME * 3);
        expect(fire).not.toHaveBeenCalled();
        advance(FALLBACK - FRAME * 3 - 1);
        expect(fire).not.toHaveBeenCalled();
        advance(1);
        expect(ran(fire)).toEqual([1]);
    });

    it("runs once even when the frame and the fallback both arrive", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(FALLBACK * 2);

        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("leaving the screen drops the click that is waiting", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));
        view.unmount();
        advance(DELAY * 3);

        expect(ran(fire)).toEqual([1]);
    });

    it("leaving the screen before the first click's frame drops that one too", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        view.unmount();
        advance(DELAY * 3);

        expect(fire).not.toHaveBeenCalled();
    });

    it("cancel() drops the waiting click and the next click is a first click", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(20);
        act(() => view.result.current.call(2));
        act(() => view.result.current.cancel());
        advance(DELAY * 2);
        expect(ran(fire)).toEqual([1]);

        act(() => view.result.current.call(3));
        advance(FRAME);
        expect(ran(fire)).toEqual([1, 3]);
    });

    it("cancel() before the first click's frame drops it", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        act(() => view.result.current.cancel());
        advance(DELAY * 2);

        expect(fire).not.toHaveBeenCalled();
    });

    it("runs the latest callback, and call() keeps its identity across renders", () => {
        const first = vi.fn();
        const second = vi.fn();
        const view = renderHook(({ fn }) => useLeadingDebouncedCallback(fn, DELAY), {
            initialProps: { fn: first },
        });
        const call = view.result.current.call;

        act(() => call(1));
        advance(20);
        act(() => call(2));
        view.rerender({ fn: second });
        advance(DELAY);

        expect(view.result.current.call).toBe(call);
        expect(first.mock.calls.map((c) => c[0])).toEqual([1]);
        expect(second.mock.calls.map((c) => c[0])).toEqual([2]);
    });
});
