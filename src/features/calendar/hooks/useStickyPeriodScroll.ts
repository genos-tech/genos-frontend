/**
 * Horizontal scroll → previous / next period on the calendar grid.
 *
 * Returns a ref to attach to the scrollable grid container. The
 * stickiness rules live in `utils/stickyScroll`; this hook is only the
 * DOM wiring around them.
 *
 * The listener is attached natively rather than through React's
 * `onWheel` because it has to call `preventDefault`. React attaches its
 * wheel handler at the root as a PASSIVE listener, where preventDefault
 * is ignored (and logs a console warning) — so a React-level handler
 * would step the period AND let the browser scroll, or bounce the
 * whole page on macOS overscroll.
 */

import { RefObject, useEffect, useRef } from "react";

import {
    advanceSticky,
    horizontalDelta,
    initialStickyState,
    STICKY_IDLE_MS,
    type StickyScrollState,
} from "../utils/stickyScroll";

interface Options {
    onPrev: () => void;
    onNext: () => void;
    /** Set false to detach entirely — e.g. while the grid is hidden
     *  behind a connect prompt, where paging makes no sense. */
    enabled?: boolean;
}

export const useStickyPeriodScroll = <T extends HTMLElement>({
    onPrev,
    onNext,
    enabled = true,
}: Options): RefObject<T | null> => {
    const ref = useRef<T | null>(null);
    const stateRef = useRef<StickyScrollState>(initialStickyState());
    const idleTimerRef = useRef<number | undefined>(undefined);

    // Held in a ref so the effect doesn't re-subscribe on every render —
    // the callbacks are recreated each time the anchor date changes,
    // which is exactly when the user is mid-gesture.
    const handlersRef = useRef({ onPrev, onNext });
    handlersRef.current = { onPrev, onNext };

    useEffect(() => {
        const node = ref.current;
        if (!node || !enabled) return;

        const onWheel = (e: WheelEvent) => {
            const delta = horizontalDelta(e);
            // Vertical gesture — leave it to the browser so the month
            // grid and the timeline's hour column still scroll.
            if (delta === null) return;

            // Owned by us now: without this the container also scrolls
            // sideways, or macOS treats it as an overscroll and animates
            // the whole page.
            e.preventDefault();

            window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(() => {
                // Gesture (and any trackpad momentum) has ended: drop
                // the lock and any partial travel.
                stateRef.current = initialStickyState();
            }, STICKY_IDLE_MS);

            const { state, step } = advanceSticky(stateRef.current, delta);
            stateRef.current = state;
            if (step === 1) handlersRef.current.onNext();
            else if (step === -1) handlersRef.current.onPrev();
        };

        // Non-passive so preventDefault is honoured.
        node.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            node.removeEventListener("wheel", onWheel);
            window.clearTimeout(idleTimerRef.current);
            stateRef.current = initialStickyState();
        };
    }, [enabled]);

    return ref;
};
