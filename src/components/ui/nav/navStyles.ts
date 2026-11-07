import { focusRing, g, type } from "../../../theme/tokens";

/**
 * Shared look of a sidebar row (MIP-1127, part of MIP-1106).
 *
 * About twenty sidebar rows used to carry their own height (28 / 30 / 32 / 60),
 * radius (4 / 8 / 10 / 12), icon size (14 - 18) and selected state (a gradient
 * in chat, an orange tint on projects, a purple tint elsewhere). They now all
 * come from here, so `NavItem` and the one place that cannot be a `NavItem`
 * (the Settings tab rail, which has to stay a Joy `Tab`) can't drift apart.
 *
 * Rules, all from the tokens:
 *  - Height is the density setting, `g.row.current`. A two-line row is the
 *    documented exception: it is `NAV_TWO_LINE_FACTOR` times a row at least,
 *    and grows with its content.
 *  - Radius `sm`. One icon size, `NAV_ICON_SIZE`.
 *  - Selected is the accent's quiet tint (`accent.subtle`), never a fill.
 *  - Hover only on a real pointer: a sticky `:hover` on touch eats the first
 *    tap (the note rows learned that the hard way).
 *  - The keyboard ring is `focusRing`, drawn INSIDE the row: sidebar scrollers
 *    and rounded rows clip an outer ring.
 */

/** Icons in a row, in px. The one size; avatars bring their own. */
export const NAV_ICON_SIZE = 16;
/** One tree level, in px. */
export const NAV_INDENT_STEP = 16;
/** A two-line row is at least this many single rows tall. */
export const NAV_TWO_LINE_FACTOR = 1.5;
/** Horizontal padding of a row, in px (the 4px grid: 8). */
export const NAV_PAD_X = 8;

/** Space above and below a row, in px: rows sit 2px apart. */
export const NAV_ROW_GAP = 1;
/** Class for an action that carries state and so is never hidden. */
export const NAV_KEEP_CLASS = "NavItem-keep";

/** The list that holds a folder's children: one tree level in, with a hairline
 *  guide. Joy's own nested inset is switched off, the row owns its indent. */
export const navNestedListSx = {
    "--List-nestedInsetStart": "0px",
    "--List-padding": "0px",
    "--List-gap": "0px",
    marginInlineStart: "8px",
    paddingInlineStart: "7px",
    borderInlineStart: `1px solid ${g.border.subtle}`,
} as const;

/** Matches every way a row says "I am the selected one": NavItem's own
 *  attribute, a Joy Tab (`aria-selected`) and Joy's `Mui-selected`. */
export const NAV_SELECTED = '&[data-selected="true"], &[aria-selected="true"], &.Mui-selected';

/** Hover on a real pointer only. */
export const NAV_HOVER_MEDIA = "@media (hover: hover) and (pointer: fine)";

/** `indent` as a CSS length: a number is a tree depth, a string a length the
 *  caller computed (the milestone tree drives its steps from container
 *  queries, so it passes a `calc()`). */
export const navIndentLength = (indent: number | string | undefined): string => {
    if (indent === undefined || indent === 0) return "0px";
    return typeof indent === "number" ? `${indent * NAV_INDENT_STEP}px` : indent;
};

/** Keyboard focus ring on the focusable part of a row (a Joy ListItemButton
 *  or a Tab). Overrides Joy's own outline. */
export const navFocusSx = {
    "&:focus-visible, &.Mui-focusVisible": {
        ...focusRing,
        outlineOffset: "-2px",
    },
} as const;

/**
 * Look of the row box: height, radius, text, hover and selected.
 * `lines: 2` is for rows with a second line (chat, sessions, favorites).
 */
export const navRowSx = ({ lines = 1 }: { lines?: 1 | 2 } = {}) =>
    ({
        boxSizing: "border-box",
        ...(lines === 1
            ? { height: g.row.current }
            : { minHeight: `calc(${g.row.current} * ${NAV_TWO_LINE_FACTOR})` }),
        borderRadius: g.radius.sm,
        ...type("body-sm"),
        fontWeight: 400,
        color: g.text.secondary,
        // Joy SvgIcon colours itself from --Icon-color, a wrapper's `color`
        // alone leaves icons grey.
        "--Icon-color": g.text.secondary,
        transition: `background-color ${g.motion.fast} ${g.ease}, color ${g.motion.fast} ${g.ease}`,
        [NAV_HOVER_MEDIA]: {
            "&:hover": {
                background: g.hover,
                color: g.text.primary,
                "--Icon-color": g.text.primary,
            },
        },
        // After hover, same specificity: selected wins and stays quiet.
        [NAV_SELECTED]: {
            background: g.accent.subtle,
            color: g.accent.text,
            "--Icon-color": g.accent.text,
            fontWeight: 500,
            [NAV_HOVER_MEDIA]: {
                "&:hover": {
                    background: g.accent.subtle,
                    color: g.accent.text,
                    "--Icon-color": g.accent.text,
                },
            },
        },
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    }) as const;
