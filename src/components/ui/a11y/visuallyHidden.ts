/**
 * Screen-reader-only content: out of the layout and the eye, still in the accessibility tree.
 *
 * Sizes are STRINGS on purpose. In MUI `sx` a bare number for `width`/`height` is a fraction of
 * the parent (`1` = 100%) and for `margin` a spacing step (`-1` = -8px), so `width: 1` made this a
 * 100% x 100% box of its containing block: clipped to nothing, but still counted by the scroll
 * area of the modal around it, which then scrolled sideways and into empty space (MIP-2059).
 */
export const visuallyHidden = {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    border: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;
