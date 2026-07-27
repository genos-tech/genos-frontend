/**
 * Emits the CSS custom properties every theme resolves to, and installs
 * the active theme.
 *
 * Shape: one `:root[data-theme="…"]` block per theme, plus a bare `:root`
 * carrying the default so an unset attribute still paints correctly.
 * Switching a theme is therefore a single attribute write — the browser
 * repaints and every `var(--gp-…)` in `purplePalette.ts` (and so every
 * frozen object in `commonStyle.ts`) follows, with no React render.
 *
 * `installActiveTheme()` runs at module import, BEFORE React mounts, so a
 * user who saved a non-default theme never sees a purple first paint.
 */

import {
    ALT_RAMP_STOPS,
    DEFAULT_THEME_ID,
    isThemeId,
    ModePrimitives,
    RAMP_STOPS,
    rgbTriplet,
    THEME_PRIMITIVES,
    ThemeId,
    ThemePrimitives,
} from "./themePalettes";

export const THEME_STORAGE_KEY = "genos-color-theme";

const STYLE_ELEMENT_ID = "genos-theme-vars";

/** `--gp-<mode>-<name>` for per-mode primitives. Components already choose
 *  the mode in JS (`isDark ? palette.dark : palette.light`), so both sets
 *  are always defined and the JS picks which name to reference. */
const modeVars = (mode: "dark" | "light", p: ModePrimitives): string[] => {
    const v = (name: string, value: string) => `--gp-${mode}-${name}: ${value};`;
    return [
        v("accent", p.accent),
        v("accent-rgb", p.accentRgb),
        v("accent-strong", p.accentStrong),
        v("accent-soft", p.accentSoft),
        v("accent-soft-rgb", p.accentSoftRgb),
        v("accent-muted", p.accentMuted),
        v("accent-muted-rgb", p.accentMutedRgb),
        v("bg", p.bg),
        v("surface-a-rgb", p.surfaceARgb),
        v("surface-b-rgb", p.surfaceBRgb),
        v("surface-c-rgb", p.surfaceCRgb),
        v("input-bg-rgb", p.inputBgRgb),
        v("text", p.text),
        v("text-muted-rgb", p.textMutedRgb),
        v("text-subtle-rgb", p.textSubtleRgb),
        v("danger-tint", p.dangerTint),
        v("danger-tint-rgb", p.dangerTintRgb),
        v("danger-tint-alt-rgb", p.dangerTintAltRgb),
        v("success-tint", p.successTint),
        v("success-tint-rgb", p.successTintRgb),
        v("success-tint-alt-rgb", p.successTintAltRgb),
        v("warning-tint", p.warningTint),
        v("warning-tint-rgb", p.warningTintRgb),
        v("warning-tint-alt-rgb", p.warningTintAltRgb),
    ];
};

/**
 * Brand-ramp aliases. These exist for the ~1,500 brand colors that were
 * hardcoded across `features/*` rather than read from the palette — a
 * literal `#7c3aed` becomes `var(--gp-brand-700)` and
 * `rgba(124,58,237,0.2)` becomes `rgba(var(--gp-brand-700-rgb), 0.2)`.
 * Each stop resolves to the same value purple always used, so the default
 * theme is unchanged and every other theme picks up the analogous stop.
 */
const rampVars = (t: ThemePrimitives): string[] => [
    ...RAMP_STOPS.flatMap((stop) => [
        `--gp-brand-${stop}: ${t.ramp[stop]};`,
        `--gp-brand-${stop}-rgb: ${rgbTriplet(t.ramp[stop])};`,
    ]),
    ...ALT_RAMP_STOPS.flatMap((stop) => [
        `--gp-brandalt-${stop}: ${t.altRamp[stop]};`,
        `--gp-brandalt-${stop}-rgb: ${rgbTriplet(t.altRamp[stop])};`,
    ]),
    `--gp-brand-950: ${t.ramp950};`,
    `--gp-brand-950-rgb: ${rgbTriplet(t.ramp950)};`,
    `--gp-tint-danger: ${t.tintDanger};`,
    `--gp-tint-danger-rgb: ${rgbTriplet(t.tintDanger)};`,
    `--gp-tint-danger-alt: ${t.tintDangerAlt};`,
    `--gp-tint-danger-alt-rgb: ${rgbTriplet(t.tintDangerAlt)};`,
    `--gp-tint-danger-deep: ${t.tintDangerDeep};`,
    `--gp-tint-danger-deep-rgb: ${rgbTriplet(t.tintDangerDeep)};`,
];

const themeVars = (t: ThemePrimitives): string[] => [
    `--gp-brand-rgb: ${t.brandRgb};`,
    `--gp-brand-alt-rgb: ${t.brandAltRgb};`,
    `--gp-grad-from: ${t.gradFrom};`,
    `--gp-grad-to: ${t.gradTo};`,
    `--gp-grad-from-hover: ${t.gradFromHover};`,
    `--gp-grad-to-hover: ${t.gradToHover};`,
    ...rampVars(t),
    ...modeVars("dark", t.dark),
    ...modeVars("light", t.light),
];

/** The full stylesheet. Exported for the unit test, which asserts every
 *  theme defines every variable the palette references. */
export const buildThemeStylesheet = (): string => {
    const blocks = (Object.keys(THEME_PRIMITIVES) as ThemeId[]).map((id) => {
        const body = themeVars(THEME_PRIMITIVES[id]).join("\n    ");
        // The default also lands on bare `:root`, so a missing/unknown
        // `data-theme` degrades to the shipped look rather than to
        // unresolved variables (which would render as transparent).
        const selector =
            id === DEFAULT_THEME_ID
                ? `:root, :root[data-theme="${id}"]`
                : `:root[data-theme="${id}"]`;
        return `${selector} {\n    ${body}\n}`;
    });
    return blocks.join("\n\n");
};

/** Read the saved theme. Never throws — storage can be blocked. */
export const readStoredThemeId = (): ThemeId => {
    if (typeof window === "undefined") return DEFAULT_THEME_ID;
    try {
        const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeId(raw) ? raw : DEFAULT_THEME_ID;
    } catch {
        return DEFAULT_THEME_ID;
    }
};

export const storeThemeId = (id: ThemeId): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
        // Private mode / quota — the in-memory value still applies for
        // this session.
    }
};

/** Point `<html>` at a theme block. The only operation a switch performs. */
export const applyThemeId = (id: ThemeId): void => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = id;
};

/**
 * Inject the stylesheet and select the saved theme. Idempotent, and safe
 * to call at import time — that's the point, it has to beat first paint.
 */
export const installActiveTheme = (): ThemeId => {
    const id = readStoredThemeId();
    if (typeof document === "undefined") return id;
    if (!document.getElementById(STYLE_ELEMENT_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        style.textContent = buildThemeStylesheet();
        // Prepended to <head> so ordinary stylesheets and Joy's generated
        // vars still win on specificity ties — this only supplies values.
        document.head.prepend(style);
    }
    applyThemeId(id);
    return id;
};
