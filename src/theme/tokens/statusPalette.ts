/**
 * The colours a team can give a status (MIP-2493). The only literal colours of this feature:
 * each one reads at 3:1 or better as an icon on the light and on the dark surface.
 * "" means "the category's own colour".
 */
export const STATUS_PALETTE = [
    { key: "slate", hex: "#64748b" },
    { key: "blue", hex: "#3b82f6" },
    { key: "indigo", hex: "#6366f1" },
    { key: "violet", hex: "#8b5cf6" },
    { key: "teal", hex: "#0d9488" },
    { key: "pink", hex: "#db2777" },
    { key: "red", hex: "#e5484d" },
    { key: "orange", hex: "#ea580c" },
    { key: "amber", hex: "#c27c0e" },
    { key: "green", hex: "#16a34a" },
] as const;

export type StatusColorKey = (typeof STATUS_PALETTE)[number]["key"];

/** "In Review" is seeded with no colour, which would make it look exactly like Open. */
export const IN_REVIEW_COLOR = STATUS_PALETTE[3].hex;
