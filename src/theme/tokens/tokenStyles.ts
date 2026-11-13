/**
 * Emits the design tokens as CSS custom properties (`--g-*`).
 *
 * Mode is resolved in CSS, not JS: Joy writes `data-joy-color-scheme` on
 * `<html>` (checked in the browser, 2026-11-07), and `themeStyles.ts`
 * writes `data-theme`. Each theme × mode block keys on both attributes,
 * so `var(--g-text)` is simply the right text color wherever it is used.
 * No component needs `isDark` to pick a color.
 *
 * The same blocks also match `[data-g-theme][data-g-mode]` on any element.
 * That lets the style-guide page render a theme other than the active one
 * inside a wrapper (custom properties set on an element beat the inherited
 * `:root` values).
 *
 * Fallbacks: bare `:root` is purple light and
 * `:root[data-joy-color-scheme]` is purple in that mode, so a missing
 * `data-theme` never leaves a `--g-*` unresolved (same rule as
 * `themeStyles.ts`).
 */

import { DENSITIES, installActiveDensity } from "../density";
import { DEFAULT_THEME_ID, THEME_IDS, ThemeId } from "../themePalettes";
import { alphaCss, buildRoles, Mode, RoleColors, SemanticRoles } from "./roles";
import { CONTROL, FONT_STACKS, MOTION, RADIUS, ROW, SPACE, TYPE_SCALE } from "./scales";

const STYLE_ELEMENT_ID = "genos-design-tokens";
export const MODES: Mode[] = ["light", "dark"];

const semanticVars = (name: string, s: SemanticRoles): [string, string][] => [
    [`${name}-solid`, s.solid],
    [`${name}-solid-fg`, s.solidFg],
    [`${name}-text`, s.text],
    [`${name}-subtle`, alphaCss(s.subtle)],
    [`${name}-border`, alphaCss(s.border)],
];

/** Every color role as [`--g-` suffix, CSS value]. Exported so the page
 *  and the test list exactly what the stylesheet defines. */
export const roleVars = (r: RoleColors): [string, string][] => [
    ["bg", r.bg],
    ["bg-subtle", r.bgSubtle],
    ["surface", r.surface],
    ["surface-raised", r.surfaceRaised],
    ["hover", alphaCss(r.hover)],
    ["active", alphaCss(r.active)],
    ["border-subtle", alphaCss(r.borderSubtle)],
    ["border", alphaCss(r.border)],
    ["border-strong", alphaCss(r.borderStrong)],
    ["text", r.text],
    ["text-secondary", r.textSecondary],
    ["text-tertiary", r.textTertiary],
    ["text-disabled", r.textDisabled],
    ["accent", r.accent],
    ["accent-hover", r.accentHover],
    ["accent-fg", r.accentFg],
    ["accent-text", r.accentText],
    ["link", r.link],
    ["link-visited", r.linkVisited],
    ["link-hover", r.linkHover],
    ["text-quote", r.textQuote],
    ["text-code", r.codeInk],
    ["text-code-sent", r.codeInkSent],
    ["accent-subtle", alphaCss(r.accentSubtle)],
    ["accent-border", alphaCss(r.accentBorder)],
    ["focus", r.focus],
    ["brand-gradient", r.brandGradient],
    ["brand-gradient-hover", r.brandGradientHover],
    ...semanticVars("danger", r.danger),
    ...semanticVars("success", r.success),
    ...semanticVars("warning", r.warning),
    ...semanticVars("info", r.info),
    ["scrim", alphaCss(r.scrim)],
    ["shadow-sm", r.shadowSm],
    ["shadow-md", r.shadowMd],
    ["shadow-lg", r.shadowLg],
    ["ink-rgb", r.inkRgb],
];

const spaceKey = (k: string) => k.replace(".", "-");

export const scaleVars = (): [string, string][] => [
    ...Object.entries(TYPE_SCALE).flatMap(([level, s]): [string, string][] => [
        [`type-${level}-size`, `${s.size}px`],
        [`type-${level}-line`, `${s.line}px`],
        [`type-${level}-weight`, String(s.weight)],
        [`type-${level}-tracking`, s.tracking],
    ]),
    ...Object.entries(RADIUS).map(([k, v]): [string, string] => [`radius-${k}`, `${v}px`]),
    ...Object.entries(SPACE).map(([k, v]): [string, string] => [`space-${spaceKey(k)}`, `${v}px`]),
    ...Object.entries(CONTROL).map(([k, v]): [string, string] => [`control-${k}`, `${v}px`]),
    ...Object.entries(ROW).map(([k, v]): [string, string] => [`row-${k}`, `${v}px`]),
    // The row height the user chose (Settings -> Appearance -> Density). The
    // bare `:root` value is the default density; `densityBlocks()` re-points it.
    ["row", "var(--g-row-default)"],
    ["motion-fast", MOTION.fast],
    ["motion-base", MOTION.base],
    ["motion-slow", MOTION.slow],
    ["ease", MOTION.ease],
    ["ease-out", MOTION.easeOut],
    ["font-body", FONT_STACKS.geist],
    ["font-mono", FONT_STACKS.mono],
];

const block = (selectors: string[], vars: [string, string][]) =>
    `${selectors.join(",\n")} {\n${vars.map(([k, v]) => `    --g-${k}: ${v};`).join("\n")}\n}`;

const selectorsFor = (id: ThemeId, mode: Mode): string[] => {
    const own = [
        `:root[data-theme="${id}"][data-joy-color-scheme="${mode}"]`,
        `[data-g-theme="${id}"][data-g-mode="${mode}"]`,
    ];
    if (id !== DEFAULT_THEME_ID) return own;
    const fallback = [`:root[data-joy-color-scheme="${mode}"]`];
    if (mode === "light") fallback.unshift(":root");
    return [...fallback, ...own];
};

/**
 * First paint, before Joy has set `data-joy-color-scheme` (it does so when
 * React mounts; there is no init script). Without this the bare `:root`
 * fallback is LIGHT, so a dark-OS user would see a white flash. It follows
 * the OS, as `index.css`'s old `--color-background` did, then Joy's own
 * attribute takes over (this only matches while it is absent).
 */
const firstPaintDark = (): string =>
    `@media (prefers-color-scheme: dark) {\n${THEME_IDS.map((id) => {
        const sel = `:root[data-theme="${id}"]:not([data-joy-color-scheme])`;
        const selectors =
            id === DEFAULT_THEME_ID ? [":root:not([data-joy-color-scheme])", sel] : [sel];
        return block(selectors, roleVars(buildRoles(id, "dark")))
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n");
    }).join("\n\n")}\n}`;

/**
 * `--g-row` follows `data-density` on `<html>`. The `[data-g-density]` form
 * lets the style-guide page show all three heights side by side inside a
 * wrapper, the way `[data-g-theme]` does for themes. Declared after the
 * `:root` block with higher specificity, so an unset or unknown attribute
 * still resolves to the default row. "default" gets a block too: a
 * `[data-g-density="default"]` wrapper inside a compact page must reset
 * `--g-row` rather than inherit the page's value.
 */
const densityBlocks = (): string[] =>
    DENSITIES.map((d) =>
        block(
            [`:root[data-density="${d}"]`, `[data-g-density="${d}"]`],
            [["row", `var(--g-row-${d})`]]
        )
    );

export const buildTokenStylesheet = (): string =>
    [
        block([":root"], scaleVars()),
        ...densityBlocks(),
        ...THEME_IDS.flatMap((id) =>
            MODES.map((mode) => block(selectorsFor(id, mode), roleVars(buildRoles(id, mode))))
        ),
        firstPaintDark(),
    ].join("\n\n");

/** Inject the token stylesheet once. Idempotent. In P1 only the style-guide
 *  page calls it; P2 moves the call to boot, next to `installActiveTheme`. */
export const installDesignTokens = (): void => {
    if (typeof document === "undefined") return;
    // The density attribute is what `--g-row` keys on, so it is set here, in
    // the same boot step as the stylesheet it selects into.
    installActiveDensity();
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = buildTokenStylesheet();
    document.head.prepend(style);
};
