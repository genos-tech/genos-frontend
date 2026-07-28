/**
 * Turning a horizontal wheel/trackpad gesture into period steps.
 *
 * The requirement is "sticky": scrolling should page to the next month /
 * week / day, but only once the user has pushed *enough*. A raw
 * one-event-per-step mapping is unusable — a single trackpad flick emits
 * dozens of wheel events and would fly through half a year.
 *
 * Three mechanisms, each solving a different failure:
 *
 *   1. **A distance threshold.** Deltas accumulate and only trigger a
 *      step once they cross `STICKY_THRESHOLD_PX`. This is the "must
 *      scroll enough" part.
 *   2. **A lock after each step.** Trackpads emit momentum events for
 *      several hundred ms after the fingers lift. Without a lock, that
 *      tail immediately re-crosses the threshold and skips a second
 *      period the user never asked for.
 *   3. **Idle reset.** The lock releases, and the accumulator zeroes,
 *      only after the gesture has genuinely stopped. That also stops two
 *      unrelated small nudges minutes apart from summing into a step.
 *
 * The decision logic is pure and lives here so the feel can be tested
 * without synthesising DOM wheel events.
 */

/** How much horizontal travel commits to a period change. Tuned so a
 *  deliberate two-finger swipe pages once, while an incidental sideways
 *  drift during vertical scrolling does nothing. */
export const STICKY_THRESHOLD_PX = 140;

/** Quiet period that ends a gesture: releases the lock and clears any
 *  partial accumulation. Long enough to outlast trackpad momentum,
 *  short enough that a deliberate second swipe isn't blocked. */
export const STICKY_IDLE_MS = 160;

export interface StickyScrollState {
    /** Horizontal travel since the last step or reset, in px. */
    accumulated: number;
    /** True while a step has fired and the gesture hasn't ended yet. */
    locked: boolean;
}

export const initialStickyState = (): StickyScrollState => ({ accumulated: 0, locked: false });

/** -1 = go to the previous period, 1 = next, 0 = not yet. */
export type StickyStep = -1 | 0 | 1;

/**
 * Fold one wheel delta into the state.
 *
 * Returns the new state plus whichever step it commits to. Positive
 * delta means scrolling right / content moving left, which reads as
 * "forward in time" — the same direction the next-period chevron moves.
 */
export const advanceSticky = (
    state: StickyScrollState,
    delta: number
): { state: StickyScrollState; step: StickyStep } => {
    // While locked we still swallow the delta (the caller keeps
    // preventing default so the page doesn't lurch) but never step.
    if (state.locked) return { state, step: 0 };

    const accumulated = state.accumulated + delta;
    if (Math.abs(accumulated) < STICKY_THRESHOLD_PX) {
        return { state: { accumulated, locked: false }, step: 0 };
    }
    return {
        state: { accumulated: 0, locked: true },
        step: accumulated > 0 ? 1 : -1,
    };
};

/**
 * Wheel `deltaMode` normalisation.
 *
 * Chrome reports pixels, but Firefox commonly reports LINES (deltaY of
 * 3 per notch) and some setups report PAGES. Without this the same
 * gesture is ~16× weaker in Firefox and the feature would read as
 * broken there rather than merely differently tuned.
 */
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

export const normalizeDelta = (delta: number, deltaMode: number): number => {
    if (deltaMode === DOM_DELTA_LINE) return delta * LINE_HEIGHT_PX;
    if (deltaMode === DOM_DELTA_PAGE) return delta * PAGE_HEIGHT_PX;
    return delta;
};

export interface WheelLike {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    shiftKey: boolean;
}

/**
 * The horizontal travel a wheel event represents, or null when the
 * gesture is vertical and should be left alone.
 *
 * Two input styles both count as horizontal:
 *   - a trackpad two-finger sideways swipe, which fills `deltaX`;
 *   - shift + wheel on a plain mouse, the long-standing convention for
 *     horizontal scrolling, which fills `deltaY` instead.
 *
 * Requiring `|deltaX| > |deltaY|` for the first case matters: trackpad
 * gestures are never perfectly axis-aligned, and treating any sideways
 * component as horizontal would hijack ordinary vertical scrolling of
 * the timeline's hour grid.
 */
export const horizontalDelta = (e: WheelLike): number | null => {
    if (e.shiftKey) {
        const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        return raw === 0 ? null : normalizeDelta(raw, e.deltaMode);
    }
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return null;
    return normalizeDelta(e.deltaX, e.deltaMode);
};
