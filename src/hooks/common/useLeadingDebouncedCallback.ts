import { useCallback, useEffect, useRef } from "react";

/**
 * Leading-edge debounce with a trailing catch-up, for "open this task" clicks.
 *
 * Opening a task starts a chain of requests, so a person who clicks through
 * many rows quickly should load only the row they land on. The plain
 * (trailing) debounce did that, but it also made EVERY click wait the whole
 * delay, even a single, ordinary one. This one waits only when it has to:
 *
 * - `call(arg)` with no other call in the last `delayMs` runs `fn(arg)` at once.
 * - Calls inside that window collapse to the last one, which runs `delayMs`
 *   after it. Every call restarts the window, so a burst runs its first call
 *   and its last call only.
 * - `cancel()` (and unmounting) drops a call that is still waiting.
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

    const cancel = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        waitingRef.current = null;
    }, []);

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
            if (isFirstCall) {
                waitingRef.current = null;
                fnRef.current(arg);
            } else {
                waitingRef.current = { arg };
            }
        },
        [delayMs]
    );

    useEffect(() => cancel, [cancel]);

    return { call, cancel };
}
