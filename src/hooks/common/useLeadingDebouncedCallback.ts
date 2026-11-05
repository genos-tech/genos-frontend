import { useCallback, useEffect, useRef } from "react";

// How long a first call waits for a painted frame before it runs anyway. A
// hidden tab never paints, so `requestAnimationFrame` never fires there.
const NEXT_PAINT_FALLBACK_MS = 100;

/**
 * Runs `run` right after the browser has painted the next frame, and returns a
 * function that drops it if it has not run yet.
 *
 * The animation-frame callback runs BEFORE the paint, so the work is queued
 * from it as a timer task, which runs after it. If no frame comes (hidden tab,
 * no `requestAnimationFrame`) a fallback timer runs it instead. It runs once.
 */
function runAfterNextPaint(run: () => void): () => void {
    let settled = false;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;
    let afterPaint: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
        if (fallback !== null) clearTimeout(fallback);
        if (frame !== null) cancelAnimationFrame(frame);
        if (afterPaint !== null) clearTimeout(afterPaint);
        fallback = null;
        frame = null;
        afterPaint = null;
    };
    const fire = () => {
        if (settled) return;
        settled = true;
        clear();
        run();
    };

    fallback = setTimeout(fire, NEXT_PAINT_FALLBACK_MS);
    if (typeof requestAnimationFrame === "function") {
        frame = requestAnimationFrame(() => {
            frame = null;
            afterPaint = setTimeout(fire, 0);
        });
    }

    return () => {
        settled = true;
        clear();
    };
}

/**
 * Leading-edge debounce with a trailing catch-up, for "open this task" clicks.
 *
 * Opening a task starts a chain of requests and a whole-app render, so a person
 * who clicks through many rows quickly should load only the row they land on.
 * The plain (trailing) debounce did that, but it also made EVERY click wait the
 * whole delay, even a single, ordinary one. This one waits only when it has to:
 *
 * - `call(arg)` with no other call in the last `delayMs` runs `fn(arg)` right
 *   after the NEXT PAINTED FRAME, not inside the call. The click's own render
 *   (the highlight, the pane) is cheap and has to be on screen first; running
 *   the heavy work in the same batch made the click feel slower to respond.
 *   Without a painted frame (hidden tab) it runs after ~100 ms.
 * - A call made before that frame arrives supersedes the first call: only the
 *   last call runs, `delayMs` after it.
 * - Calls inside the window collapse to the last one, which runs `delayMs`
 *   after it. Every call restarts the window, so a burst runs its first call
 *   (if it was alone for a frame) and its last call only.
 * - `cancel()` (and unmounting) drops a call that is still waiting, the first
 *   one included.
 *
 * The window is measured from the last call, not from the last run: a call
 * made as the trailing one runs is a first call again.
 *
 * `call` keeps its identity while `delayMs` is unchanged, and always runs the
 * latest `fn`, so it can be handed to memoised rows without a stale closure.
 */
export function useLeadingDebouncedCallback<A>(fn: (arg: A) => void, delayMs: number) {
    const fnRef = useRef(fn);
    fnRef.current = fn;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The last call made inside the window, waiting for it to close.
    const waitingRef = useRef<{ arg: A } | null>(null);
    // Drops the first call while it waits for its frame (null once it ran).
    const dropLeadingRef = useRef<(() => void) | null>(null);

    const dropLeading = useCallback(() => {
        dropLeadingRef.current?.();
        dropLeadingRef.current = null;
    }, []);

    const cancel = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        waitingRef.current = null;
        dropLeading();
    }, [dropLeading]);

    const call = useCallback(
        (arg: A) => {
            const isFirstCall = timerRef.current === null;
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            // Arm the window before running anything, so a `fn` that throws
            // cannot leave the next call thinking the window is closed.
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                const waiting = waitingRef.current;
                waitingRef.current = null;
                if (waiting) fnRef.current(waiting.arg);
            }, delayMs);
            // Whatever the first call was still waiting to run is superseded.
            dropLeading();
            if (isFirstCall) {
                waitingRef.current = null;
                dropLeadingRef.current = runAfterNextPaint(() => {
                    dropLeadingRef.current = null;
                    fnRef.current(arg);
                });
            } else {
                waitingRef.current = { arg };
            }
        },
        [delayMs, dropLeading]
    );

    useEffect(() => cancel, [cancel]);

    return { call, cancel };
}
