import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * True while the element is narrower than `px`. For layouts that depend on the width of a PANE
 * (a resizable panel next to others), which no media query can see.
 *
 * Holds a boolean, not the width, so dragging a panel re-renders only when the answer changes.
 * A width of 0 is not an answer (hidden, as a kept-alive page is, or no layout at all): the last
 * one stands, and it starts as false.
 */
export const useIsNarrowerThan = (ref: RefObject<HTMLElement | null>, px: number): boolean => {
    const [narrower, setNarrower] = useState(false);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const measure = () => {
            const width = element.getBoundingClientRect().width;
            if (width > 0) setNarrower(width < px);
        };
        // Before paint, so the first frame is already the right layout.
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, px]);

    return narrower;
};
