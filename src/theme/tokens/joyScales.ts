/**
 * The mode-independent parts of the Joy theme, built from the design
 * tokens (MIP-1118): type levels, weights, radius and shadows.
 *
 * Joy's defaults are what the app has been using, so these replace them
 * rather than add to them. The level NAMES are Joy's (`level="body-sm"`
 * keeps working at every call site); what changes is what they mean:
 * `body-sm` was 14px, it is now the token's 13px; `body-md` 16px → 14px.
 *
 *  - Sizes are rem, so a browser text-size setting still scales the app.
 *  - Line heights are UNITLESS ratios (line ÷ size), not px: a level whose
 *    `fontSize` is overridden in `sx` then gets a proportional line box
 *    rather than a fixed one that clips a larger size.
 *  - Joy's per-level text color is left alone (it is not set here), so
 *    `body-sm` / `body-xs` keep reading `text.tertiary`. `joyPalette.ts`
 *    makes that role AA-readable for exactly that reason.
 */

import { RADIUS, TYPE_SCALE } from "./scales";

/** Joy has no `caption` level; the token exists for the new components. */
type JoyLevel = Exclude<keyof typeof TYPE_SCALE, "caption">;

const rem = (px: number) => `${px / 16}rem`;
const ratio = (line: number, size: number) => Number((line / size).toFixed(4));

const level = (name: JoyLevel) => {
    const s = TYPE_SCALE[name];
    return {
        fontSize: rem(s.size),
        lineHeight: ratio(s.line, s.size),
        fontWeight: s.weight,
        letterSpacing: s.tracking,
    };
};

export const joyTypography = {
    h1: level("h1"),
    h2: level("h2"),
    h3: level("h3"),
    h4: level("h4"),
    "title-lg": level("title-lg"),
    "title-md": level("title-md"),
    "title-sm": level("title-sm"),
    "body-lg": level("body-lg"),
    "body-md": level("body-md"),
    "body-sm": level("body-sm"),
    "body-xs": level("body-xs"),
};

/**
 * Joy's `fontSize` scale is what Button, Chip and Checkbox size their own
 * text from (not the type levels), so it has to agree with the levels or
 * every control sits 1px larger than the body text beside it. Only `sm` and
 * `md` move: they are text roles (13 and 14px). `xl` and `xl2` also size
 * decorator and icon glyphs inside Joy components, so they stay Joy's.
 */
export const joyFontSize = {
    sm: rem(TYPE_SCALE["body-sm"].size),
    md: rem(TYPE_SCALE["body-md"].size),
};

/** Three weights only: 700 is retired (two bold weights side by side look
 *  like a mistake at these sizes). Joy's `sm` was 300 and `xl` 700. */
export const joyFontWeight = { sm: 400, md: 500, lg: 600, xl: 600 };

/** Joy's `xl` (16px) has no token: only modals reach for it. */
export const joyRadius = {
    xs: `${RADIUS.xs}px`,
    sm: `${RADIUS.sm}px`,
    md: `${RADIUS.md}px`,
    lg: `${RADIUS.lg}px`,
    xl: "16px",
};

/** Shadows point at the mode-resolved `--g-shadow-*` variables, so one
 *  theme object serves light and dark. Flat surfaces, quiet depth: sm under
 *  buttons and inputs, md under menus, lg under modals. */
export const joyShadow = {
    xs: "var(--g-shadow-sm)",
    sm: "var(--g-shadow-sm)",
    md: "var(--g-shadow-md)",
    lg: "var(--g-shadow-lg)",
    xl: "var(--g-shadow-lg)",
};
