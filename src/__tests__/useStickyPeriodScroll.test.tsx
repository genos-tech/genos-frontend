/**
 * The DOM half of sticky scroll: listener wiring, and the idle reset
 * that releases the post-step lock.
 *
 * `utils/stickyScroll` covers the arithmetic. What can only break here:
 *
 *  - the listener must be NON-PASSIVE, or `preventDefault` is ignored
 *    and the container scrolls sideways / macOS bounces the page while
 *    we also page the calendar;
 *  - vertical gestures must pass through untouched, or the timeline's
 *    hour grid stops scrolling;
 *  - the lock must actually release once the gesture ends, or the
 *    feature works exactly once per mount.
 */

import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStickyPeriodScroll } from "../features/calendar/hooks/useStickyPeriodScroll";
import { STICKY_IDLE_MS, STICKY_THRESHOLD_PX } from "../features/calendar/utils/stickyScroll";

interface HarnessProps {
    onPrev: () => void;
    onNext: () => void;
    enabled?: boolean;
    mounted?: boolean;
}

const Harness = ({ onPrev, onNext, enabled = true, mounted = true }: HarnessProps) => {
    const ref = useStickyPeriodScroll<HTMLDivElement>({ onPrev, onNext, enabled });
    // `mounted` models Joy's Modal, which renders NO children while
    // closed — the grid node appears only once the user opens it.
    return mounted ? <div data-testid="grid" ref={ref} /> : null;
};

/** Dispatches a real WheelEvent so `passive` and `preventDefault`
 *  behave as they would in a browser — `fireEvent.wheel` alone wouldn't
 *  exercise the listener options. */
const wheel = (node: Element, init: Partial<WheelEventInit>) => {
    const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 0,
        deltaY: 0,
        deltaMode: 0,
        ...init,
    });
    node.dispatchEvent(event);
    return event;
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useStickyPeriodScroll", () => {
    it("pages forward after enough horizontal travel", () => {
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);
        const grid = screen.getByTestId("grid");

        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("pages backward on negative travel", () => {
        const onPrev = vi.fn();
        render(<Harness onNext={vi.fn()} onPrev={onPrev} />);

        wheel(screen.getByTestId("grid"), { deltaX: -STICKY_THRESHOLD_PX });

        expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it("ignores a small nudge", () => {
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);

        wheel(screen.getByTestId("grid"), { deltaX: 20 });

        expect(onNext).not.toHaveBeenCalled();
    });

    it("swallows trackpad momentum instead of paging repeatedly", () => {
        // The failure this exists for: after the fingers lift, a flick
        // keeps emitting deltas for hundreds of ms. Without the lock
        // the calendar skips several months in one gesture.
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);
        const grid = screen.getByTestId("grid");

        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });
        for (let i = 0; i < 60; i++) wheel(grid, { deltaX: 30 });

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("releases the lock once the gesture has ended", () => {
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);
        const grid = screen.getByTestId("grid");

        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });
        act(() => void vi.advanceTimersByTime(STICKY_IDLE_MS + 10));
        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });

        expect(onNext).toHaveBeenCalledTimes(2);
    });

    it("keeps the lock while the gesture is still going", () => {
        // Each event re-arms the idle timer, so a continuous stream
        // never reaches the reset.
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);
        const grid = screen.getByTestId("grid");

        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });
        for (let i = 0; i < 10; i++) {
            act(() => void vi.advanceTimersByTime(STICKY_IDLE_MS - 20));
            wheel(grid, { deltaX: 40 });
        }

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("prevents default on a horizontal gesture", () => {
        // Requires the listener to be registered non-passive; React's
        // own onWheel is passive and would silently ignore this.
        render(<Harness onNext={vi.fn()} onPrev={vi.fn()} />);

        const event = wheel(screen.getByTestId("grid"), { deltaX: 40 });

        expect(event.defaultPrevented).toBe(true);
    });

    it("leaves vertical gestures alone", () => {
        const onNext = vi.fn();
        render(<Harness onNext={onNext} onPrev={vi.fn()} />);

        const event = wheel(screen.getByTestId("grid"), { deltaX: 2, deltaY: 400 });

        expect(event.defaultPrevented).toBe(false);
        expect(onNext).not.toHaveBeenCalled();
    });

    it("does nothing when disabled", () => {
        const onNext = vi.fn();
        render(<Harness enabled={false} onNext={onNext} onPrev={vi.fn()} />);

        const event = wheel(screen.getByTestId("grid"), { deltaX: STICKY_THRESHOLD_PX * 3 });

        expect(onNext).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it("calls the latest handlers after a re-render", () => {
        // The steppers close over the current anchor date and are
        // recreated whenever it changes — which is precisely when the
        // user is mid-gesture. A stale closure here would page from the
        // wrong month every time after the first.
        const seen: number[] = [];
        const Wrapper = () => {
            const [count, setCount] = useState(0);
            return (
                <>
                    <button onClick={() => setCount((c) => c + 1)}>bump</button>
                    <Harness onNext={() => seen.push(count)} onPrev={vi.fn()} />
                </>
            );
        };
        render(<Wrapper />);
        const grid = screen.getByTestId("grid");

        fireEvent.click(screen.getByText("bump"));
        fireEvent.click(screen.getByText("bump"));
        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });

        expect(seen).toEqual([2]);
    });

    it("binds to a node that mounts AFTER the hook first runs", () => {
        // The bug this exists for: `CalendarModal` is mounted
        // permanently with an `open` prop, and Joy's Modal renders no
        // children while closed. An effect reading `ref.current` runs
        // once, finds null, and never runs again — so the listener was
        // never attached and horizontal scroll silently did nothing.
        const onNext = vi.fn();
        const { rerender } = render(<Harness mounted={false} onNext={onNext} onPrev={vi.fn()} />);
        expect(screen.queryByTestId("grid")).toBeNull();

        // The user opens the modal.
        rerender(<Harness mounted onNext={onNext} onPrev={vi.fn()} />);
        wheel(screen.getByTestId("grid"), { deltaX: STICKY_THRESHOLD_PX });

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("rebinds across a close/reopen cycle", () => {
        const onNext = vi.fn();
        const { rerender } = render(<Harness mounted onNext={onNext} onPrev={vi.fn()} />);
        wheel(screen.getByTestId("grid"), { deltaX: STICKY_THRESHOLD_PX });
        expect(onNext).toHaveBeenCalledTimes(1);

        // Close…
        rerender(<Harness mounted={false} onNext={onNext} onPrev={vi.fn()} />);
        // …and reopen. A fresh node needs a fresh binding.
        rerender(<Harness mounted onNext={onNext} onPrev={vi.fn()} />);
        wheel(screen.getByTestId("grid"), { deltaX: STICKY_THRESHOLD_PX });

        expect(onNext).toHaveBeenCalledTimes(2);
    });

    it("clears a half-finished gesture when the node goes away", () => {
        // Reopening mid-swipe must not inherit stale travel and page
        // immediately.
        const onNext = vi.fn();
        const { rerender } = render(<Harness mounted onNext={onNext} onPrev={vi.fn()} />);
        wheel(screen.getByTestId("grid"), { deltaX: STICKY_THRESHOLD_PX - 20 });

        rerender(<Harness mounted={false} onNext={onNext} onPrev={vi.fn()} />);
        rerender(<Harness mounted onNext={onNext} onPrev={vi.fn()} />);
        wheel(screen.getByTestId("grid"), { deltaX: 30 });

        expect(onNext).not.toHaveBeenCalled();
    });

    it("detaches on unmount", () => {
        const onNext = vi.fn();
        const { unmount } = render(<Harness onNext={onNext} onPrev={vi.fn()} />);
        const grid = screen.getByTestId("grid");
        unmount();

        wheel(grid, { deltaX: STICKY_THRESHOLD_PX });

        expect(onNext).not.toHaveBeenCalled();
    });
});
