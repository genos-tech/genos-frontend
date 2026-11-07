/**
 * Mode-independent scales for the design system (MIP-1106): type, radius,
 * spacing, control sizes and motion.
 *
 * Replaces ~65 hand-picked font sizes, 37 radii and 65 transitions with a
 * handful of steps. Every step has a job; if a design needs a value that
 * isn't here, the scale is wrong and gets a new step, the call site doesn't
 * get a literal.
 */

/** Type: size / line-height in px, weight. Named after the Joy levels they
 *  will replace in P2, so `level="body-sm"` keeps meaning the same thing.
 *  13px body-sm is the default for dense UI (lists, tables, sidebars), the
 *  way Linear sets its chrome; 14px body-md is for reading (messages,
 *  descriptions). */
export const TYPE_SCALE = {
    h1: { size: 32, line: 40, weight: 600, tracking: "-0.022em" },
    h2: { size: 24, line: 32, weight: 600, tracking: "-0.019em" },
    h3: { size: 20, line: 28, weight: 600, tracking: "-0.017em" },
    h4: { size: 17, line: 24, weight: 600, tracking: "-0.013em" },
    "title-lg": { size: 16, line: 24, weight: 600, tracking: "-0.011em" },
    "title-md": { size: 14, line: 20, weight: 600, tracking: "-0.006em" },
    "title-sm": { size: 13, line: 18, weight: 600, tracking: "-0.003em" },
    "body-lg": { size: 16, line: 24, weight: 400, tracking: "-0.011em" },
    "body-md": { size: 14, line: 20, weight: 400, tracking: "-0.006em" },
    "body-sm": { size: 13, line: 18, weight: 400, tracking: "-0.003em" },
    "body-xs": { size: 12, line: 16, weight: 400, tracking: "0em" },
    caption: { size: 11, line: 14, weight: 500, tracking: "0.005em" },
} as const;

export type TypeLevel = keyof typeof TYPE_SCALE;

/** Three weights only. 700 is retired: at these sizes 600 already reads
 *  as bold, and two bold weights side by side look like a mistake. */
export const WEIGHTS = { regular: 400, medium: 500, semibold: 600 } as const;

/** Radius by component size, not one value for everything: small things
 *  get small corners. */
export const RADIUS = {
    xs: 4, // tags, small badges, checkbox
    sm: 6, // buttons, inputs, nav items, menu items
    md: 8, // cards, menus, popovers, table container
    lg: 12, // modals, large panels
    full: 9999, // avatars, pills, presence dots
} as const;

/** 4px grid. */
export const SPACE = {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
} as const;

/** Control heights. md is the default; tables and sidebars use sm rows. */
export const CONTROL = { sm: 28, md: 32, lg: 36 } as const;

/** Row heights for lists and tables. The tasks table is 53px today. */
export const ROW = { compact: 32, default: 36, comfortable: 44 } as const;

export const MOTION = {
    fast: "120ms", // hover, press, toggles
    base: "180ms", // menus, popovers, tabs
    slow: "260ms", // modals, drawers, page-level
    ease: "cubic-bezier(0.2, 0, 0, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
} as const;

/** Font stacks. The body face is Geist (Ken, 2026-11-07, chosen over
 *  Inter at the P1 review). Geist has no Japanese glyphs, so CJK falls
 *  through to Noto Sans JP, which the app already loads: Japanese then
 *  looks the same on every platform. `index.css` repeats this string
 *  (it must resolve before any script runs); a test keeps them equal. */
export const FONT_STACKS = {
    geist: '"Geist Variable", "Noto Sans JP Variable", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Segoe UI", sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
} as const;
