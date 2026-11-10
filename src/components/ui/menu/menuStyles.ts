/**
 * The one look of every menu (MIP-1128): a raised surface, rows from the
 * control scale, hover / focus / selected / danger from the role tokens.
 * Mode and theme switch through the CSS variables, so there is no `isDark`
 * branch here and a menu follows the user's theme without re-rendering.
 *
 * Kept apart from the components because a constants module can export
 * objects without tripping the fast-refresh rule, and the tests read these
 * values to pin the contract.
 */

import { focusRing, g, type } from "../../../theme/tokens";

/** Item height: the control scale's medium step, 32px. */
export const MENU_ITEM_HEIGHT = g.control.md;
/** Touch devices get the comfortable row (44px): 32px is too small a target. */
export const MENU_ITEM_HEIGHT_COARSE = g.row.comfortable;

export const menuSurfaceSx = {
    "--List-padding": "4px",
    "--List-gap": "2px",
    "--List-radius": g.radius.md,
    "--ListItem-gap": "8px",
    "--ListItem-minHeight": MENU_ITEM_HEIGHT,
    "--ListItem-radius": g.radius.sm,
    "--ListItem-paddingX": "8px",
    "--ListItem-paddingY": "0px",
    "--ListDivider-gap": "4px",
    "@media (pointer: coarse)": { "--ListItem-minHeight": MENU_ITEM_HEIGHT_COARSE },
    minWidth: 180,
    maxWidth: "calc(100vw - 16px)",
    // Scrolls inside the viewport instead of running off it.
    maxHeight: "calc(100dvh - 16px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "thin",
    scrollbarColor: `${g.border.strong} transparent`,
    background: g.surface.raised,
    border: `1px solid ${g.border.default}`,
    borderRadius: g.radius.md,
    boxShadow: g.shadow.md,
    color: g.text.primary,
    ...type("body-sm"),
    // Opacity only: the popper positions this node with `transform`.
    animation: `moreMenuFadeIn ${g.motion.base} ${g.easeOut}`,
    "@keyframes moreMenuFadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
} as const;

const inset = { outline: `2px solid ${g.focus}`, outlineOffset: "-2px" } as const;

/**
 * A row. `&&` doubles the class so these beat Joy's own hover rule
 * (`&:not(.Mui-selected, [aria-selected="true"]):hover`) without `!important`.
 */
export type MenuRowTone = "default" | "danger" | "accent";

const TONES = {
    default: { fg: g.text.primary, icon: g.text.secondary, fill: g.hover, press: g.active },
    danger: {
        fg: g.danger.text,
        icon: g.danger.text,
        fill: g.danger.subtle,
        press: g.danger.subtle,
    },
    accent: {
        fg: g.accent.text,
        icon: g.accent.text,
        fill: g.accent.subtle,
        press: g.accent.subtle,
    },
} as const;

export const menuRowSx = (tone: MenuRowTone = "default") => {
    const t = TONES[tone];
    return {
        ...type("body-sm"),
        color: t.fg,
        "--Icon-color": t.icon,
        border: "none",
        cursor: "pointer",
        transitionProperty: "background-color, color",
        transitionDuration: g.motion.fast,
        transitionTimingFunction: g.ease,
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        // Joy's own hover also sets `color`, so it is restated here: a caller's
        // `sx.color` would lose to it (use `tone` instead).
        "&&:hover": { background: t.fill, color: t.fg },
        "&&:active": { background: t.press },
        "&&.Mui-focusVisible": { background: t.fill, ...inset },
        "&&.Mui-selected": {
            background: g.accent.subtle,
            color: g.accent.text,
            "--Icon-color": g.accent.text,
            fontWeight: 500,
        },
        "&&.Mui-disabled": {
            color: g.text.disabled,
            "--Icon-color": g.text.disabled,
            background: "transparent",
            cursor: "default",
        },
    } as const;
};

export const menuDividerSx = { background: g.border.subtle } as const;

export const menuGroupLabelSx = {
    ...type("caption"),
    color: g.text.tertiary,
    px: "8px",
    pt: "6px",
    pb: "2px",
} as const;

/** The trigger every "..." menu shares: a quiet icon that fills on hover and while open. */
export const menuTriggerSx = {
    border: "none",
    borderRadius: g.radius.sm,
    color: g.text.tertiary,
    "--Icon-color": g.text.tertiary,
    "&:hover": { background: g.hover, color: g.text.primary, "--Icon-color": g.text.primary },
    "&[aria-expanded='true']": {
        background: g.active,
        color: g.text.primary,
        "--Icon-color": g.text.primary,
    },
    "&:focus-visible": focusRing,
} as const;

/**
 * Keeps a menu inside the viewport on the cross axis too (MIP-1331).
 *
 * Popper only slides a menu along the edge it is attached to; if it fits neither
 * above nor below its trigger it keeps the side with more room and runs off the
 * screen. A tall menu opened from a row near the middle of a phone then had its last
 * row (Delete) under the bottom edge. `altAxis` slides it up until it fits; the
 * surface's `maxHeight` (100dvh - 16px) guarantees it can. Module-level so Joy's `useMemo`
 * over `modifiers` stays stable.
 */
export const MENU_POPPER_MODIFIERS = [
    { name: "preventOverflow", options: { altAxis: true, padding: 8, tether: false } },
];
