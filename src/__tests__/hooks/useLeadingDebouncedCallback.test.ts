/**
 * MIP-968: the timing of a task-row click.
 *
 * Clicking a row used to wait 150 ms before it loaded anything, even for a
 * single, ordinary click. The wait exists for the person who clicks through
 * many rows quickly (one load for the row they land on, not one per row), so
 * it now applies only to follow-up clicks:
 *   - a click with no other click in the last `delay` ms runs at once;
 *   - clicks inside that window collapse to the LAST one, which runs `delay`
 *     ms after it;
 *   - leaving the screen drops whatever is still waiting.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLeadingDebouncedCallback } from "../../hooks/common/useLeadingDebouncedCallback";

const DELAY = 150;

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

const setup = (delay = DELAY) => {
    const fire = vi.fn<(id: number) => void>();
    const view = renderHook(({ fn }) => useLeadingDebouncedCallback(fn, delay), {
        initialProps: { fn: fire },
    });
    return { fire, view };
};

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("useLeadingDebouncedCallback", () => {
    it("a single click runs at once, with no timer needed", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));

        expect(fire).toHaveBeenCalledTimes(1);
        expect(fire).toHaveBeenCalledWith(1);
        // ...and does not run again when the window closes.
        advance(DELAY * 3);
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("two clicks 50 ms apart: the first runs at once, the second after the window", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));

        expect(fire).toHaveBeenCalledTimes(1);
        expect(fire).toHaveBeenLastCalledWith(1);

        advance(DELAY - 1);
        expect(fire).toHaveBeenCalledTimes(1);
        advance(1);
        expect(fire).toHaveBeenCalledTimes(2);
        expect(fire).toHaveBeenLastCalledWith(2);
    });

    it("five rapid clicks run the first and the last only", () => {
        const { fire, view } = setup();

        for (const id of [1, 2, 3, 4, 5]) {
            act(() => view.result.current.call(id));
            advance(10);
        }
        expect(fire).toHaveBeenCalledTimes(1);
        advance(DELAY);

        expect(fire.mock.calls.map((c) => c[0])).toEqual([1, 5]);
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
        expect(fire.mock.calls.map((c) => c[0])).toEqual([1]);
        advance(1);
        expect(fire.mock.calls.map((c) => c[0])).toEqual([1, 3]);
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
        expect(fire).toHaveBeenCalledTimes(3);
        expect(fire).toHaveBeenLastCalledWith(3);
    });

    it("the window is measured from the last CLICK: a click as the trailing one runs is a first click", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));
        advance(DELAY); // 2 runs now, 150 ms after click 2
        act(() => view.result.current.call(3));

        expect(fire.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    });

    it("leaving the screen drops the click that is waiting", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(50);
        act(() => view.result.current.call(2));
        view.unmount();
        advance(DELAY * 3);

        expect(fire.mock.calls.map((c) => c[0])).toEqual([1]);
    });

    it("cancel() drops the waiting click and the next click is a first click", () => {
        const { fire, view } = setup();

        act(() => view.result.current.call(1));
        advance(10);
        act(() => view.result.current.call(2));
        act(() => view.result.current.cancel());
        advance(DELAY * 2);
        expect(fire.mock.calls.map((c) => c[0])).toEqual([1]);

        act(() => view.result.current.call(3));
        expect(fire.mock.calls.map((c) => c[0])).toEqual([1, 3]);
    });

    it("runs the latest callback, and call() keeps its identity across renders", () => {
        const first = vi.fn();
        const second = vi.fn();
        const view = renderHook(({ fn }) => useLeadingDebouncedCallback(fn, DELAY), {
            initialProps: { fn: first },
        });
        const call = view.result.current.call;

        act(() => call(1));
        advance(10);
        act(() => call(2));
        view.rerender({ fn: second });
        advance(DELAY);

        expect(view.result.current.call).toBe(call);
        expect(first.mock.calls.map((c) => c[0])).toEqual([1]);
        expect(second.mock.calls.map((c) => c[0])).toEqual([2]);
    });
});
