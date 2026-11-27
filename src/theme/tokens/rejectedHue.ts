/**
 * The hue of the task status "Rejected" (MIP-2494): finished but not done. A warm brown, so it
 * reads as neither done's green nor an alarm. It has no `--g-*` role of its own: the CSS form
 * mixes it with the surface's text color, which keeps it readable in light and dark. The one
 * consumer is `features/tasks/meta/taskTone.ts`.
 */

export const REJECTED_SWATCH = {
    base: "#8d6e63",
    /** Carries `solidFg` at AA. */
    solid: "#6d4c41",
    solidFg: "#ffffff",
    textLight: "#6d4c41",
    textDark: "#bcaaa4",
};

export const REJECTED_CSS = {
    text: "color-mix(in srgb, #8d6e63 55%, var(--g-text))",
    subtle: "rgba(141, 110, 99, 0.14)",
    border: "rgba(141, 110, 99, 0.45)",
};
