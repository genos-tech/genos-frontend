import { useCallback, useRef } from "react";

type LongPressOptions = {
    /** ms the user must hold before the long-press fires. */
    threshold?: number;
    /** px of movement that cancels the press (turns it into a scroll). */
    moveTolerance?: number;
};

type LongPressHandlers = {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
    /**
     * Returns true if the *most recent* touch fired the long-press
     * callback. Used by click handlers to suppress the synthetic click
     * that follows a touch end (so a long-press doesn't also navigate).
     * Auto-clears after one read so the next tap is treated as a tap.
     */
    consumedTap: () => boolean;
};

// Touch-only long-press detector. Returns spreadable handlers + a
// `consumedTap()` flag for click handlers to short-circuit after a
// long-press fires. Desktop / mouse events are intentionally ignored —
// long-press is a touch UX pattern; on desktop, hover already exposes
// the same affordances.
export const useLongPress = (
    onLongPress: () => void,
    options: LongPressOptions = {}
): LongPressHandlers => {
    const { threshold = 500, moveTolerance = 8 } = options;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const firedRef = useRef(false);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onTouchStart = useCallback(
        (e: React.TouchEvent) => {
            firedRef.current = false;
            const t = e.touches[0];
            if (!t) return;
            startPosRef.current = { x: t.clientX, y: t.clientY };
            clearTimer();
            timerRef.current = setTimeout(() => {
                firedRef.current = true;
                onLongPress();
            }, threshold);
        },
        [onLongPress, threshold, clearTimer]
    );

    const onTouchMove = useCallback(
        (e: React.TouchEvent) => {
            const start = startPosRef.current;
            const t = e.touches[0];
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) > moveTolerance || Math.abs(dy) > moveTolerance) {
                clearTimer();
            }
        },
        [moveTolerance, clearTimer]
    );

    const onTouchEnd = useCallback(
        (_e: React.TouchEvent) => {
            clearTimer();
            startPosRef.current = null;
        },
        [clearTimer]
    );

    const onTouchCancel = useCallback(() => {
        clearTimer();
        startPosRef.current = null;
        firedRef.current = false;
    }, [clearTimer]);

    const consumedTap = useCallback(() => {
        if (firedRef.current) {
            firedRef.current = false;
            return true;
        }
        return false;
    }, []);

    return { onTouchStart, onTouchEnd, onTouchMove, onTouchCancel, consumedTap };
};
