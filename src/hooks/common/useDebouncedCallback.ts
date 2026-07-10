import { useCallback, useEffect, useRef } from "react";

/**
 * Trailing-edge debounced callback with manual `flush` / `cancel`.
 *
 * Built for the collaborative editors' body→parent sync: `onChange` fires on
 * every keystroke, but serializing `editor.document` and pushing it into
 * parent state that often makes typing lag (each push re-renders a large
 * parent tree). Scheduling with `run()` keeps that work off the keystroke
 * path; the wrapped `fn` reads live state when the timer fires.
 *
 * - `run()`    — (re)arm the trailing timer; `fn` executes `delayMs` after
 *                the last call.
 * - `flush()`  — if a call is pending, execute `fn` immediately (used on
 *                editor blur so click-away/submit flows read fresh state).
 *                No-op when nothing is pending.
 * - `cancel()` — drop any pending call without executing.
 *
 * `fn` receives `isFlush`: `true` when invoked via `flush()` (the caller
 * needs the resulting state committed synchronously — e.g. a submit click
 * right after blur reads it), `false` on the trailing timer. The editors
 * use this to mark the timer-path parent re-render as a React transition
 * (interruptible by keystrokes) while keeping the flush path synchronous.
 *
 * The latest `fn` is kept in a ref, so callers may pass a fresh closure on
 * every render without resetting the timer. Pending work is cancelled on
 * unmount — callers for whom the final call matters should `flush()` from
 * an appropriate DOM event (e.g. blur) instead.
 */
export function useDebouncedCallback(fn: (isFlush?: boolean) => void, delayMs: number) {
    const fnRef = useRef(fn);
    fnRef.current = fn;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancel = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const flush = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            fnRef.current(true);
        }
    }, []);

    const run = useCallback(() => {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            fnRef.current(false);
        }, delayMs);
    }, [delayMs]);

    useEffect(() => cancel, [cancel]);

    return { run, flush, cancel };
}
