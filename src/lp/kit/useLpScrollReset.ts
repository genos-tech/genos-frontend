import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { smoothScrollBehavior } from "../../utils/motion";

/**
 * Where the window scroll should be for each public-page history entry (MIP-1867). React Router
 * changes the route without touching window scroll, so a page opened from the footer used to
 * appear scrolled to the bottom. Keyed by `location.key`, so Back returns to the same position.
 *
 * An entry with no history state (the first page loaded, or a plain `<a href="#x">`) has the key
 * "default" in React Router, so several different entries share it. For those the key adds the
 * path and hash (MIP-1926), so an in-page anchor jump is not taken for Back/Forward and does not
 * overwrite the position saved for the first page.
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
    const { key, pathname, hash } = useLocation();
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
        const entryKey = key !== "default" ? key : `default:${pathname}${hash}`;
        const navigated = lastKey !== null && lastKey !== key;
        lastKey = key;
        currentKey = entryKey;

        // Nothing saved for this entry (a native #anchor on a "default" entry, say): fall through
        // to the hash branch instead of restoring another entry's position.
        const saved = savedScroll.get(entryKey);
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
    }, [key, pathname, hash, navType]);
}
