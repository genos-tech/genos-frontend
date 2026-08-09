import { useCallback, useEffect, useRef } from "react";

/**
 * Drives a custom scroll-position indicator (a thin thumb on the right edge)
 * for a react-virtuoso scroller.
 *
 * WHY THIS EXISTS: iOS hides native overlay scrollbars between gestures and
 * ignores `::-webkit-scrollbar` sizing entirely, so the chat message pane
 * shows no persistent scrollbar on a phone (desktop, incl. a narrowed window,
 * still gets the classic 8px `.custom-scrollbar-*` bar). This indicator is a
 * plain DOM element — which iOS *does* render — positioned from the scroller's
 * geometry.
 *
 * WHY IMPERATIVE: the whole update path writes the thumb element's style
 * DIRECTLY via a ref, coalesced into one `requestAnimationFrame` per burst of
 * scroll events. It holds NO React state, so it adds ZERO re-renders to the
 * hot scroll path — matching the deliberate imperative pattern already used
 * for the `chat-msg-scrolling` class (see `MessageListRenderer`), and staying
 * clear of the scroll jank that a `useState(scrollTop)` would reintroduce. It
 * only ever READS scroll geometry and never calls `scrollTo`/`scrollBy`, so it
 * cannot perturb Virtuoso's own positioning (incl. the iOS momentum
 * correction tamed by the `defaultItemHeight` fix).
 *
 * Usage: spread the returned `scrollerRefCallback` into Virtuoso's
 * `scrollerRef` (after any existing assignment) and attach `thumbRef` to the
 * indicator element. Re-attachment on Virtuoso remount is automatic: the
 * callback fires with the new scroller element (and `null` on unmount), and we
 * detach from the previous one first.
 */

// Shortest the thumb is allowed to get on a very long list, so it stays
// grabbable-looking and visible.
const MIN_THUMB_PX = 24;
// Resting opacity when the content overflows. Deliberately clearly visible
// (this indicator exists precisely because users couldn't see one on mobile),
// not a barely-there hint.
const VISIBLE_OPACITY = "0.6";

// Only run where the native bar is absent: touch / coarse-pointer devices.
// On a fine-pointer desktop (including a narrowed browser window) the classic
// `.custom-scrollbar-*` bar already shows, so attaching here would double up.
// Guarded so a non-browser/legacy env (no `matchMedia`) simply attaches.
const isCoarsePointer = (): boolean => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return true;
    }
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
};

export function useScrollIndicator() {
    const scrollerRef = useRef<HTMLElement | null>(null);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    // Read geometry once, then write once — batched inside a single rAF so it
    // never interleaves reads and writes (no layout thrash) and runs at most
    // once per frame regardless of how many scroll events fired.
    const measure = useCallback(() => {
        rafRef.current = null;
        const scroller = scrollerRef.current;
        const thumb = thumbRef.current;
        if (!scroller || !thumb) return;

        const { scrollTop, scrollHeight, clientHeight } = scroller;
        // No overflow (+1 absorbs sub-pixel rounding) → nothing to indicate.
        if (scrollHeight <= clientHeight + 1) {
            thumb.style.opacity = "0";
            return;
        }

        const thumbHeight = Math.max(MIN_THUMB_PX, (clientHeight * clientHeight) / scrollHeight);
        const maxTravel = clientHeight - thumbHeight;
        const denom = scrollHeight - clientHeight;
        // `denom > 0` is guaranteed by the overflow check above; guarded anyway.
        const thumbTop = denom > 0 ? (scrollTop / denom) * maxTravel : 0;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${thumbTop}px)`;
        thumb.style.opacity = VISIBLE_OPACITY;
    }, []);

    const scheduleMeasure = useCallback(() => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(measure);
    }, [measure]);

    const detach = useCallback(() => {
        const prev = scrollerRef.current;
        if (prev) prev.removeEventListener("scroll", scheduleMeasure);
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, [scheduleMeasure]);

    // Callback-ref for Virtuoso's `scrollerRef`. Fires with the scroller
    // element on mount and (on remount / unmount) with the new element or
    // null — so a chat switch that remounts Virtuoso re-attaches cleanly.
    const scrollerRefCallback = useCallback(
        (el: HTMLElement | null) => {
            detach();
            scrollerRef.current = el;
            if (!el || !isCoarsePointer()) return;

            el.addEventListener("scroll", scheduleMeasure, { passive: true });

            // Recompute when geometry changes without a scroll event: the
            // scroller itself resizing (rotation, keyboard) AND the content
            // growing (images decoding, messages arriving) — the latter shows
            // up as the inner content element resizing, not the scroller.
            const observer = new ResizeObserver(scheduleMeasure);
            observer.observe(el);
            const content = el.firstElementChild;
            if (content) observer.observe(content);
            observerRef.current = observer;

            scheduleMeasure();
        },
        [detach, scheduleMeasure]
    );

    // Cleanup if the host component unmounts without Virtuoso first calling the
    // ref with null.
    useEffect(() => detach, [detach]);

    return { scrollerRefCallback, thumbRef };
}
