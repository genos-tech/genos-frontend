/**
 * Joy's color palettes for one theme and mode, derived from the design
 * roles (MIP-1118). Joy components ask Joy's palette, the new components
 * ask the roles, and both are answered by `buildRoles`, so they cannot
 * disagree about what "the accent" or "secondary text" is.
 *
 * Values are REAL colors (hex, or rgba strings), never `var()`: Joy's
 * `extendTheme` parses palette values to derive channel tokens.
 *
 * Decisions worth knowing before you edit:
 *
 *  - `text.tertiary` is the AA-readable `textSecondary` role, NOT the
 *    `textTertiary` role. Joy's `body-sm` and `body-xs` levels (about 1,050
 *    uses) are colored `text.tertiary`, and they carry content, not just
 *    meta. The 3:1 meta role would have dropped all of it below AA.
 *    Joy's `text.secondary` sits halfway between primary and that role.
 *  - The gradient is NOT in the `primary` palette. `solidBg` feeds Chip,
 *    Badge, Switch, Checkbox, Slider and progress bars as well as Button;
 *    those get the flat accent. Only a primary solid BUTTON gets the
 *    gradient (see `joyComponents.ts`).
 *  - Status palettes use the fixed red / green / amber hues, the same on
 *    every theme (Ken, 2026-11-07).
 */

import { THEME_PRIMITIVES, ThemeId } from "../themePalettes";
import { composite, contrast, hexToOklch, oklchToHex } from "./color";
import { Alpha, alphaCss, buildRoles, Mode, SemanticRoles } from "./roles";

/** Same lightness steps in both modes; Joy picks the end it needs. */
const NEUTRAL_RAMP: Record<number, [number, number]> = {
    50: [0.985, 0.004],
    100: [0.965, 0.006],
    200: [0.925, 0.008],
    300: [0.87, 0.01],
    400: [0.74, 0.012],
    500: [0.62, 0.014],
    600: [0.52, 0.016],
    700: [0.43, 0.016],
    800: [0.31, 0.016],
    900: [0.2, 0.014],
};

/** Joy's `neutral` 50-900, tinted toward the theme's accent hue. */
export const neutralRamp = (themeId: ThemeId): Record<string, string> => {
    const hue = hexToOklch(THEME_PRIMITIVES[themeId].ramp[600]).h;
    return Object.fromEntries(
        Object.entries(NEUTRAL_RAMP).map(([stop, [l, c]]) => [stop, oklchToHex(l, c, hue)])
    );
};

const AA = 4.5;

/**
 * A tint raised a step for hover / pressed, stopping short of the step
 * that would push `fg` below AA on any backdrop. A darker hover must never
 * make the label harder to read, and it can't go below the resting tint.
 */
const stepped = (tint: Alpha, by: number, fg: string, backdrops: string[]): Alpha => {
    const reads = (a: number) =>
        backdrops.every((b) => contrast(fg, composite(tint.hex, a, b)) >= AA);
    let a = Math.min(1, tint.a + by);
    while (a > tint.a && !reads(a)) a = Number((a - 0.01).toFixed(3));
    return { hex: tint.hex, a: Number(a.toFixed(3)) };
};

const darkened = (solid: string, by: number) => composite("#000000", by, solid);

/**
 * A tint painted onto `over`, as one opaque color. Joy's `soft` variants
 * (Avatar, Chip, Checkbox, Badge...) are OPAQUE fills, and a translucent one
 * disappears on any surface that is not the page's own: the Create Project
 * modal is hard-coded dark inside a light page, and its avatars and
 * checkboxes vanished. Hover and pressed states of plain and outlined
 * variants stay translucent; only the soft family is flattened.
 */
const opaque = (tint: Alpha, over: string) => composite(tint.hex, tint.a, over);

const status = (s: SemanticRoles, backdrops: string[]) => ({
    solidBg: s.solid,
    solidHoverBg: darkened(s.solid, 0.1),
    solidActiveBg: darkened(s.solid, 0.18),
    solidColor: s.solidFg,
    softColor: s.text,
    softBg: opaque(s.subtle, backdrops[1]),
    softHoverBg: opaque(stepped(s.subtle, 0.06, s.text, backdrops), backdrops[1]),
    softActiveBg: opaque(stepped(s.subtle, 0.12, s.text, backdrops), backdrops[1]),
    plainColor: s.text,
    plainHoverBg: alphaCss(s.subtle),
    plainActiveBg: alphaCss(stepped(s.subtle, 0.08, s.text, backdrops)),
    outlinedColor: s.text,
    outlinedBorder: alphaCss(s.border),
    outlinedHoverBg: alphaCss(s.subtle),
    outlinedActiveBg: alphaCss(stepped(s.subtle, 0.08, s.text, backdrops)),
});

export const joyPalette = (themeId: ThemeId, mode: Mode) => {
    const r = buildRoles(themeId, mode);
    const { ramp } = THEME_PRIMITIVES[themeId];
    const midText = composite(r.textSecondary, 0.5, r.text);
    const backdrops = [r.bg, r.surface];

    return {
        // The accent. Chip / Badge / Switch / Checkbox read `solidBg`, so it
        // is the flat accent here; the button gradient lives in the Button.
        primary: {
            ...ramp,
            solidBg: r.accent,
            solidHoverBg: r.accentHover,
            solidActiveBg: r.accentHover,
            solidColor: r.accentFg,
            softColor: r.accentText,
            softBg: opaque(r.accentSubtle, r.surface),
            softHoverBg: opaque(stepped(r.accentSubtle, 0.06, r.accentText, backdrops), r.surface),
            softActiveBg: opaque(
                stepped(r.accentSubtle, 0.12, r.accentText, backdrops),
                r.surface
            ),
            plainColor: r.accentText,
            plainHoverBg: alphaCss(r.accentSubtle),
            plainActiveBg: alphaCss(stepped(r.accentSubtle, 0.08, r.accentText, backdrops)),
            outlinedColor: r.accentText,
            outlinedBorder: alphaCss(r.accentBorder),
            outlinedHoverBg: alphaCss(r.accentSubtle),
            outlinedActiveBg: alphaCss(stepped(r.accentSubtle, 0.08, r.accentText, backdrops)),
        },
        neutral: {
            ...neutralRamp(themeId),
            plainColor: r.textSecondary,
            plainHoverColor: r.text,
            plainHoverBg: alphaCss(r.hover),
            plainActiveBg: alphaCss(r.active),
            outlinedColor: r.textSecondary,
            outlinedBorder: alphaCss(r.border),
            outlinedHoverBg: alphaCss(r.hover),
            outlinedActiveBg: alphaCss(r.active),
            softColor: r.text,
            softBg: opaque(r.hover, r.surface),
            softHoverBg: opaque(r.active, r.surface),
            softActiveBg: opaque(r.border, r.surface),
            // A neutral solid is the inverse chip: tooltips use it.
            solidBg: r.textSecondary,
            solidHoverBg: r.text,
            solidActiveBg: r.text,
            solidColor: r.bg,
        },
        danger: status(r.danger, backdrops),
        success: status(r.success, backdrops),
        warning: status(r.warning, backdrops),
        background: {
            body: r.bg,
            surface: r.surface,
            popup: r.surfaceRaised,
            level1: r.bgSubtle,
            level2: composite(r.hover.hex, 0.06, r.bg),
            level3: composite(r.hover.hex, 0.1, r.bg),
            tooltip: r.textSecondary,
            backdrop: alphaCss(r.scrim),
        },
        text: {
            primary: r.text,
            secondary: midText,
            tertiary: r.textSecondary,
            icon: r.textTertiary,
        },
        divider: alphaCss(r.borderSubtle),
        focusVisible: r.focus,
    };
};
