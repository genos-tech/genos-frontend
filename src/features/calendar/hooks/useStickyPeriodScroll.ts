/**
 * Horizontal scroll → previous / next period on the calendar grid.
 *
 * Returns a CALLBACK ref to attach to the scrollable grid container. The
 * stickiness rules live in `utils/stickyScroll`; this hook is only the
 * DOM wiring around them.
 *
 * Two things here are load-bearing and were each a real bug:
 *
 *   1. **A callback ref, not a ref object.** `CalendarModal` is mounted
 *      permanently with an `open` prop, and Joy's `Modal` renders no
 *      children while closed. An effect reading `ref.current` therefore
 *      runs once, finds `null`, and never runs again — the listener is
 *      never attached and the feature appears to do nothing. A callback
 *      ref fires when the node actually mounts, which is the moment the
 *      user opens the modal.
 *   2. **A native, non-passive listener.** React registers its `onWheel`
 *      at the root as PASSIVE, where `preventDefault` is ignored (and
 *      warns). A React-level handler would page the calendar AND let the
 *      container scroll sideways, or bounce the whole page on macOS
 *      overscroll.
 */

import { useCallback, useEffect, useRef } from "react";

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
}: Options): ((node: T | null) => void) => {
    const nodeRef = useRef<T | null>(null);
    const detachRef = useRef<(() => void) | null>(null);
    const stateRef = useRef<StickyScrollState>(initialStickyState());
    const idleTimerRef = useRef<number | undefined>(undefined);
    const enabledRef = useRef(enabled);

    // Held in a ref so re-attaching isn't needed on every render — the
    // steppers are recreated whenever the anchor date changes, which is
    // exactly when the user is mid-gesture.
    const handlersRef = useRef({ onPrev, onNext });
    handlersRef.current = { onPrev, onNext };

    /** (Re)bind the listener to whatever node is current. Safe to call
     *  repeatedly; always detaches the previous binding first. */
    const attach = useCallback(() => {
        detachRef.current?.();
        detachRef.current = null;

        const node = nodeRef.current;
        if (!node || !enabledRef.current) return;

        const onWheel = (e: WheelEvent) => {
            const delta = horizontalDelta(e);
            // Vertical gesture — leave it to the browser so the month
            // grid and the timeline's hour column still scroll.
            if (delta === null) return;

            // Ours now: without this the container also scrolls
            // sideways, or macOS treats it as overscroll and animates
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

        node.addEventListener("wheel", onWheel, { passive: false });
        detachRef.current = () => node.removeEventListener("wheel", onWheel);
    }, []);

    const setNode = useCallback(
        (node: T | null) => {
            nodeRef.current = node;
            // Fires on mount AND unmount (React calls callback refs with
            // null on teardown), so this is both the bind and the
            // cleanup path for the node itself.
            attach();
            if (!node) {
                window.clearTimeout(idleTimerRef.current);
                stateRef.current = initialStickyState();
            }
        },
        [attach]
    );

    useEffect(() => {
        enabledRef.current = enabled;
        attach();
        return () => {
            detachRef.current?.();
            detachRef.current = null;
            window.clearTimeout(idleTimerRef.current);
        };
    }, [enabled, attach]);

    return setNode;
};
