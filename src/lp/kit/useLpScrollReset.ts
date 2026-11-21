import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { smoothScrollBehavior } from "../../utils/motion";

/**
 * Where the window scroll should be for each public-page history entry (MIP-1867). React Router
 * changes the route without touching window scroll, so a page opened from the footer used to
 * appear scrolled to the bottom. Keyed by `location.key`, so Back returns to the same position.
 */
const savedScroll = new Map<string, number>();
let currentKey: string | null = null;
let lastKey: string | null = null;

/**
 * Scroll and focus for a marketing page's route change. Mounted by LpShell, which every public
 * page renders, so the signed-in app is not affected.
 *
 * - Back / Forward: restore the position saved for that entry.
 * - A hash (`#section`): land on the anchor, smooth unless reduced motion asks for instant.
 * - Anything else: top of the page, instant, before the first paint (no visible jump).
 * - A route change (not the first load) moves focus to <main> without scrolling; the first
 *   load leaves focus alone.
 */
export function useLpScrollReset(): void {
    const { key, hash } = useLocation();
    const navType = useNavigationType();

    // Remember the position of the entry on screen, so Back can return to it.
    useEffect(() => {
        const onScroll = () => {
            if (currentKey !== null) savedScroll.set(currentKey, window.scrollY);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useLayoutEffect(() => {
        const navigated = lastKey !== null && lastKey !== key;
        lastKey = key;
        currentKey = key;

        const saved = savedScroll.get(key);
        if (navType === "POP" && saved !== undefined) {
            window.scrollTo({ top: saved, left: 0, behavior: "auto" });
            return;
        }
        if (hash) {
            const target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (target) {
                target.scrollIntoView({ block: "start", behavior: smoothScrollBehavior() });
                return;
            }
        }
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        if (navigated) document.getElementById("lp-main")?.focus({ preventScroll: true });
    }, [key, hash, navType]);
}
