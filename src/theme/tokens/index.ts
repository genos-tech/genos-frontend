/**
 * Design tokens (MIP-1106) as `var(--g-…)` references for `sx` / `style`.
 *
 *     sx={{ color: g.text.secondary, borderColor: g.border.default }}
 *
 * Every value is a CSS variable, so it follows the active theme and mode
 * with no re-render and no `isDark` branch. The usual `var()` caveats from
 * `purplePalette.ts` apply: no hex-alpha concatenation and no MUI
 * `alpha()`. Use the pre-composed roles (`hover`, `accent.subtle`, …) or
 * `rgba(var(--g-ink-rgb), α)`.
 */

import { TYPE_SCALE, TypeLevel } from "./scales";

const v = (name: string) => `var(--g-${name})`;

const semantic = (name: string) => ({
    solid: v(`${name}-solid`),
    solidFg: v(`${name}-solid-fg`),
    text: v(`${name}-text`),
    subtle: v(`${name}-subtle`),
    border: v(`${name}-border`),
});

export const g = {
    bg: { default: v("bg"), subtle: v("bg-subtle") },
    surface: { default: v("surface"), raised: v("surface-raised") },
    hover: v("hover"),
    active: v("active"),
    border: { subtle: v("border-subtle"), default: v("border"), strong: v("border-strong") },
    text: {
        primary: v("text"),
        secondary: v("text-secondary"),
        tertiary: v("text-tertiary"),
        disabled: v("text-disabled"),
        /** Quoted text inside a chat bubble (7:1 on every bubble fill). */
        quote: v("text-quote"),
        /** Inline code ink in a received chat bubble (dark 7.4:1, light 4.5:1 on every bubble fill). */
        code: v("text-code"),
        /** Inline code ink in a sent bubble (light: the accent family, 4.5:1 on every fill). */
        codeSent: v("text-code-sent"),
    },
    /** Links, quote bars and code ink inside chat bubbles and comments. */
    link: { default: v("link"), visited: v("link-visited"), hover: v("link-hover") },
    accent: {
        solid: v("accent"),
        hover: v("accent-hover"),
        fg: v("accent-fg"),
        text: v("accent-text"),
        subtle: v("accent-subtle"),
        border: v("accent-border"),
    },
    focus: v("focus"),
    brand: { gradient: v("brand-gradient"), gradientHover: v("brand-gradient-hover") },
    danger: semantic("danger"),
    success: semantic("success"),
    warning: semantic("warning"),
    info: semantic("info"),
    scrim: v("scrim"),
    shadow: { sm: v("shadow-sm"), md: v("shadow-md"), lg: v("shadow-lg") },
    radius: {
        xs: v("radius-xs"),
        sm: v("radius-sm"),
        md: v("radius-md"),
        lg: v("radius-lg"),
        full: v("radius-full"),
    },
    control: { sm: v("control-sm"), md: v("control-md"), lg: v("control-lg") },
    row: {
        compact: v("row-compact"),
        default: v("row-default"),
        comfortable: v("row-comfortable"),
        /** The user's chosen row height (Settings -> Appearance -> Density).
         *  A row that should follow the setting uses this, not a fixed step. */
        current: v("row"),
    },
    motion: { fast: v("motion-fast"), base: v("motion-base"), slow: v("motion-slow") },
    ease: v("ease"),
    easeOut: v("ease-out"),
    font: { body: v("font-body"), mono: v("font-mono") },
} as const;

/** Typography for one level, spread into `sx`. */
export const type = (level: TypeLevel) => ({
    fontSize: v(`type-${level}-size`),
    lineHeight: v(`type-${level}-line`),
    fontWeight: v(`type-${level}-weight`),
    letterSpacing: v(`type-${level}-tracking`),
});

/** The keyboard focus ring. One definition for the whole app. */
export const focusRing = {
    outline: `2px solid ${v("focus")}`,
    outlineOffset: "2px",
} as const;

export { TYPE_SCALE };
export type { TypeLevel };
