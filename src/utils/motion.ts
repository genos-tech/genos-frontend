/**
 * Reduced motion for script-driven motion (MIP-1829).
 *
 * CSS motion is switched off in the stylesheets under `@media (prefers-reduced-motion)`. Scroll
 * motion is driven from JS (`scrollIntoView`, `scrollTo`), where CSS cannot reach it, so those
 * calls take their `behavior` from here. A literal `behavior: "smooth"` elsewhere in src fails
 * `motionScrollBehavior.test.ts`.
 */

/** True when the user's device or browser asks for less motion. */
export const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The `behavior` for a scroll that would animate: "smooth", or "auto" (instant) when reduced. */
export const smoothScrollBehavior = (): "auto" | "smooth" =>
    prefersReducedMotion() ? "auto" : "smooth";
