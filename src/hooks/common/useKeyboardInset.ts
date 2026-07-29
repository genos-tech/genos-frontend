import { useEffect } from "react";

/**
 * Publishes how much of the viewport the on-screen keyboard is covering,
 * as the CSS variable `--keyboard-inset`.
 *
 * Why this is needed at all: on iOS the keyboard does NOT resize the
 * layout viewport. `window.innerHeight`, `100vh` and `100dvh` are all
 * unchanged while it's up, so a composer pinned to the bottom of a
 * full-height shell ends up *behind* the keyboard — you tap the input
 * and can't see what you're typing. iOS then tries to rescue the focused
 * field by scrolling the page itself, which is what makes the whole app
 * look like it slid out of place.
 *
 * `visualViewport` is the only API that reports the actually-visible
 * region, so the keyboard height is the gap between it and the layout
 * viewport. Layouts subtract `--mobile-bottom-inset` (see index.css),
 * which takes whichever is larger — this or the tab bar — because the
 * keyboard covers the tab bar too.
 */

const VAR_NAME = "--keyboard-inset";

export const useKeyboardInset = (): void => {
    useEffect(() => {
        const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
        if (!vv) return;

        const root = document.documentElement;

        const apply = () => {
            // `offsetTop` matters when the page is pinch-zoomed or iOS has
            // scrolled the visual viewport: without it, a shifted viewport
            // reads as a keyboard that isn't there.
            const covered = window.innerHeight - (vv.height + vv.offsetTop);
            // Small negative values show up from sub-pixel rounding; a few
            // stray pixels are not a keyboard.
            const inset = covered > 1 ? Math.round(covered) : 0;
            root.style.setProperty(VAR_NAME, `${inset}px`);
        };

        apply();
        vv.addEventListener("resize", apply);
        // The visual viewport also *scrolls* under the layout viewport on
        // iOS while the keyboard animates in.
        vv.addEventListener("scroll", apply);
        return () => {
            vv.removeEventListener("resize", apply);
            vv.removeEventListener("scroll", apply);
            root.style.removeProperty(VAR_NAME);
        };
    }, []);
};
