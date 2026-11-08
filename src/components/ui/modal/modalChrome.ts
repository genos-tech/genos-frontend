/**
 * The floating "Move to page" and Close buttons of `UrlLinkModal` (the preview dialog every
 * task, note, chat and to-do preview opens in), and the room a header hosted in it keeps for
 * them (MIP-1169, MIP-1296).
 *
 * The dialog owns the geometry and publishes it as CSS variables on itself, so a header
 * anywhere inside it asks the cascade instead of carrying its own number:
 *
 *   --modal-chrome-size       36px with a mouse, 44px on a touch screen (the touch target)
 *   --modal-chrome-clearance  edge + two buttons + the gap + air, measured from the dialog's
 *                             end edge: 112px, or 128px with the bigger touch buttons
 *
 * Outside the dialog the variable is not set, so every helper here falls back to nothing: a
 * header can use it unconditionally and is unchanged on a page.
 */

/** Distance of the Close button from the dialog's corner, and the gap between the two. */
export const MODAL_CHROME_EDGE = 12;
export const MODAL_CHROME_GAP = 8;
/** Air between the leftmost button and whatever the header puts next to it. */
const MODAL_CHROME_AIR = 20;

/** Styles for the dialog itself: publishes the variables the headers read. */
export const modalChromeVarsSx = {
    "--modal-chrome-size": "36px",
    "--modal-chrome-clearance": `calc(${MODAL_CHROME_EDGE}px + 2 * var(--modal-chrome-size) + ${MODAL_CHROME_GAP}px + ${MODAL_CHROME_AIR}px)`,
    // Touch: 44px targets. The clearance follows through the variable above.
    "@media (pointer: coarse)": { "--modal-chrome-size": "44px" },
} as const;

/** The room to keep clear at the end of a header row. 0 outside the dialog. */
export const MODAL_CHROME_CLEARANCE = "var(--modal-chrome-clearance, 0px)";

/**
 * End padding for a header row: the row's own padding, or the chrome's clearance when that
 * is larger. Logical, so it follows `dir` (the app sets `dir="rtl"` for Arabic, and the
 * dialog's own buttons flip with it).
 *
 * `base` is what the row pads there on a page: one value, or one per breakpoint for a row
 * whose `px` is responsive (outside the dialog the result is then exactly that).
 *
 * Responsive on purpose: a row that sets `px` per breakpoint (the page-header frame does)
 * has its media-query rules emitted after any plain declaration, so a plain
 * `paddingInlineEnd` here would lose to its `padding-right` from `md` up.
 */
export const modalChromeEndPadding = (base: string | { xs: string; md: string } = "0px") => {
    const at = (value: string) => `max(${value}, ${MODAL_CHROME_CLEARANCE})`;
    const { xs, md } = typeof base === "string" ? { xs: base, md: base } : base;
    return { paddingInlineEnd: { xs: at(xs), md: at(md) } } as const;
};
