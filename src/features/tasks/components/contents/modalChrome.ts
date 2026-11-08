/**
 * What `UrlLinkModal`'s floating chrome ("Move to page" and Close) takes from the top-right
 * corner of its dialog: 12px from the edge + a 36px Close + 8px + a 36px "Move to page"
 * (92px), plus a little air. A task or milestone header hosted in that dialog keeps this
 * much clear at its end and draws no Close of its own (MIP-1169).
 */
export const MODAL_CHROME_CLEARANCE = "112px";
