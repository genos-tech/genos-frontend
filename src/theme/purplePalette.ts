import { extendTheme } from "@mui/joy/styles";

import { DEFAULT_THEME_ID, THEME_PRIMITIVES, ThemeId } from "./themePalettes";

// Brand-surface palette. The single source of truth for brand-surface colors
// across `components/ui/styles/commonStyle.ts` and every feature in
// `features/*`. Functional/data colors (task status, priority flags, the tag
// picker, online-status indicator) intentionally bypass this palette.
//
// ## These values are CSS variable references, not colors
//
// The file name and every export are unchanged — 39 files import this — but
// the values are now `var(--gp-…)` formulas rather than literals, so the
// palette follows the user's selected theme (Settings → General → Color
// theme). `theme/themePalettes.ts` owns what those variables resolve to and
// `theme/themeStyles.ts` emits them per theme.
//
// Why variables rather than a hook: `commonStyle.ts` destructures this
// module at IMPORT TIME into 14 static objects that 33 files consume. Those
// objects can never be re-derived by React, so the only way they can follow a
// theme is for the strings they froze to be indirections the browser
// re-resolves on repaint. Purple resolves identically to the old literals, so
// the default theme is unchanged.
//
// ## Consequences for callers — read before adding a token
//
// A `var()` reference is not a parseable color. It works anywhere the
// browser does the parsing (`sx`, inline `style`, CSS), and fails in three
// places:
//
//   1. **Hex-alpha concatenation** — ``${P.accent}20`` yields
//      `var(--gp-dark-accent)20`, which is invalid. Compose alpha instead:
//      `rgba(var(--gp-dark-accent-rgb), 0.125)`.
//   2. **JS color math** — MUI's `alpha()` / `lighten()` / `darken()` call
//      `decomposeColor`, which throws on `var()`. Add a pre-composed token
//      here (see `accentRingStrong`) rather than computing at the call site.
//   3. **SVG presentation attributes** — `<line stroke={…}>` is an XML
//      attribute and never resolves `var()`. Use `style={{ stroke: … }}`.
//      For third-party APIs that insist on a real color string (React Flow's
//      `MiniMap nodeColor`), read `THEME_PRIMITIVES` directly via
//      `useColorTheme()`.

export type PurpleTokens = {
    // Surfaces
    bg: string;
    surface: string;
    surfaceElevated: string;
    surfaceSolid: string;

    // Accent (theme-driven)
    accent: string;
    accentStrong: string;
    accentSoft: string;
    accentMuted: string;

    /** Bare "r, g, b" triplets for composing your own alpha:
     *  `` `rgba(${P.accentRgb}, 0.125)` ``. Use these instead of appending
     *  hex alpha to a color token — see consequence (1) above. */
    accentRgb: string;
    accentSoftRgb: string;
    accentMutedRgb: string;
    brandRgb: string;

    // Gradients
    accentGradient: string;
    accentGradientHover: string;
    titleGradient: string;

    // Structure
    border: string;
    borderStrong: string;
    borderMuted: string;
    divider: string;

    // Text
    text: string;
    textMuted: string;
    textSubtle: string;

    // Semantic tints (all accent-analogous — see palette doctrine above)
    dangerTint: string;
    dangerTintBg: string;
    dangerTintBgHover: string;
    dangerTintBorder: string;

    successTint: string;
    successTintBg: string;
    successTintBorder: string;

    warningTint: string;
    warningTintBg: string;
    warningTintBorder: string;

    // Effects
    glow: string;
    shadow: string;
    shadowSoft: string;
    /** Pre-composed accent at ring alpha. Exists because `alpha(accent, …)`
     *  can't parse a `var()` — see consequence (2) above. */
    accentRingStrong: string;
    accentRingSoft: string;

    // Inputs
    inputBg: string;
    inputBorder: string;
    inputFocusBorder: string;
    inputFocusShadow: string;

    // Hover / pressed surfaces
    hoverBg: string;
    activeBg: string;

    // Chip / badge surfaces
    chipBg: string;
    chipBorder: string;

    // Button surfaces
    buttonBg: string;
    buttonBgHover: string;
    buttonBorder: string;
    primaryButtonBg: string;
    primaryButtonHover: string;
    primaryButtonShadow: string;

    // Menu surfaces (dropdowns, popovers)
    menuBg: string;
    menuBorder: string;
};

// Mode-independent brand stops.
const BRAND = "var(--gp-brand-rgb)";
const BRAND_ALT = "var(--gp-brand-alt-rgb)";
const GRAD = "linear-gradient(135deg, var(--gp-grad-from) 0%, var(--gp-grad-to) 100%)";
const GRAD_HOVER =
    "linear-gradient(135deg, var(--gp-grad-from-hover) 0%, var(--gp-grad-to-hover) 100%)";

/**
 * Both modes share one structure; only the primitive namespace and a
 * handful of alpha stops differ. Building them from one function is what
 * keeps dark and light from drifting apart as tokens are added.
 */
const tokensFor = (mode: "dark" | "light"): PurpleTokens => {
    const v = (name: string) => `var(--gp-${mode}-${name})`;
    const rgb = (name: string) => `var(--gp-${mode}-${name}-rgb)`;
    const isDark = mode === "dark";
    // The light palette sits at roughly half the alpha of dark throughout —
    // named here so each token below reads as "the same idea, tuned".
    const a = <T>(dark: T, light: T): T => (isDark ? dark : light);

    return {
        // Surfaces
        bg: v("bg"),
        surface: `linear-gradient(145deg, rgba(${rgb("surface-a")},${a("0.95", "0.98")}) 0%, rgba(${rgb("surface-b")},${a("0.98", "0.99")}) 100%)`,
        surfaceElevated: `linear-gradient(135deg, rgba(${a(rgb("surface-c"), rgb("surface-a"))},${a("0.9", "0.95")}) 0%, rgba(${a(rgb("surface-a"), rgb("surface-c"))},${a("0.95", "0.92")}) 100%)`,
        surfaceSolid: `rgba(${rgb("surface-a")}, ${a("0.95", "0.98")})`,

        // Accent
        accent: v("accent"),
        accentStrong: v("accent-strong"),
        accentSoft: v("accent-soft"),
        accentMuted: v("accent-muted"),
        accentRgb: rgb("accent"),
        accentSoftRgb: rgb("accent-soft"),
        accentMutedRgb: rgb("accent-muted"),
        brandRgb: BRAND,

        // Gradients
        accentGradient: GRAD,
        accentGradientHover: GRAD_HOVER,
        titleGradient: `linear-gradient(90deg, ${a(v("accent-soft"), v("accent-strong"))} 0%, ${v("accent")} 50%, ${a(v("accent-muted"), v("accent-soft"))} 100%)`,

        // Structure
        border: `rgba(${BRAND}, ${a("0.2", "0.15")})`,
        borderStrong: `rgba(${BRAND}, ${a("0.35", "0.25")})`,
        borderMuted: `rgba(${BRAND}, ${a("0.12", "0.08")})`,
        divider: `rgba(${BRAND}, ${a("0.12", "0.1")})`,

        // Text
        text: v("text"),
        textMuted: `rgba(${rgb("text-muted")}, 0.9)`,
        textSubtle: `rgba(${rgb("text-subtle")}, 0.7)`,

        // Semantic tints
        dangerTint: v("danger-tint"),
        dangerTintBg: `linear-gradient(135deg, rgba(${rgb("danger-tint")},${a("0.15", "0.08")}) 0%, rgba(${rgb("danger-tint-alt")},${a("0.15", "0.08")}) 100%)`,
        dangerTintBgHover: `linear-gradient(135deg, rgba(${rgb("danger-tint")},${a("0.25", "0.15")}) 0%, rgba(${rgb("danger-tint-alt")},${a("0.25", "0.15")}) 100%)`,
        dangerTintBorder: `rgba(${rgb("danger-tint")}, ${a("0.3", "0.2")})`,

        successTint: v("success-tint"),
        successTintBg: `linear-gradient(135deg, rgba(${rgb("success-tint")},${a("0.12", "0.08")}) 0%, rgba(${rgb("success-tint-alt")},${a("0.12", "0.08")}) 100%)`,
        successTintBorder: `rgba(${rgb("success-tint")}, ${a("0.3", "0.2")})`,

        warningTint: v("warning-tint"),
        warningTintBg: `linear-gradient(135deg, rgba(${rgb("warning-tint")},${a("0.12", "0.08")}) 0%, rgba(${rgb("warning-tint-alt")},${a("0.12", "0.08")}) 100%)`,
        warningTintBorder: `rgba(${rgb("warning-tint")}, ${a("0.3", "0.2")})`,

        // Effects
        glow: `rgba(${BRAND}, ${a("0.25", "0.15")})`,
        shadow: a(
            `0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(${BRAND},0.12)`,
            `0 8px 32px rgba(${BRAND},0.12), 0 0 60px rgba(${BRAND},0.05)`
        ),
        shadowSoft: `0 4px 16px rgba(${BRAND}, ${a("0.4", "0.3")})`,
        accentRingStrong: `rgba(${rgb("accent")}, ${a("0.85", "0.7")})`,
        accentRingSoft: `rgba(${rgb("accent")}, ${a("0.35", "0.25")})`,

        // Inputs
        inputBg: `rgba(${rgb("input-bg")}, ${a("0.4", "0.92")})`,
        inputBorder: `rgba(${BRAND}, 0.2)`,
        inputFocusBorder: a(v("accent-soft"), v("accent")),
        inputFocusShadow: `0 0 0 3px rgba(${BRAND}, ${a("0.25", "0.12")})`,

        // Hover / pressed
        hoverBg: `rgba(${BRAND}, ${a("0.15", "0.08")})`,
        activeBg: `rgba(${BRAND}, ${a("0.25", "0.15")})`,

        // Chip / badge
        chipBg: `linear-gradient(135deg, rgba(${BRAND},${a("0.15", "0.08")}) 0%, rgba(${BRAND_ALT},${a("0.15", "0.08")}) 100%)`,
        chipBorder: `rgba(${BRAND}, ${a("0.3", "0.2")})`,

        // Buttons
        buttonBg: `linear-gradient(135deg, rgba(${BRAND},${a("0.15", "0.08")}) 0%, rgba(${BRAND_ALT},${a("0.15", "0.08")}) 100%)`,
        buttonBgHover: `linear-gradient(135deg, rgba(${BRAND},${a("0.28", "0.18")}) 0%, rgba(${BRAND_ALT},${a("0.28", "0.18")}) 100%)`,
        buttonBorder: `rgba(${BRAND}, ${a("0.3", "0.2")})`,
        primaryButtonBg: GRAD,
        primaryButtonHover: GRAD_HOVER,
        primaryButtonShadow: `0 4px 16px rgba(${BRAND}, ${a("0.4", "0.3")})`,

        // Menus
        menuBg: `linear-gradient(180deg, rgba(${rgb("surface-a")},0.98) 0%, rgba(${rgb("surface-b")},0.99) 100%)`,
        menuBorder: `rgba(${BRAND}, ${a("0.18", "0.12")})`,
    };
};

export const purplePalette: { dark: PurpleTokens; light: PurpleTokens } = {
    dark: tokensFor("dark"),
    light: tokensFor("light"),
};

/**
 * Joy UI theme for a given color theme. Wires the theme's ramp into Joy's
 * `primary` palette so any component using `color="primary"` picks up the
 * brand automatically, without touching its sx prop.
 *
 * Real hex values, deliberately — NOT the `var()` references above. Joy's
 * `extendTheme` derives channel tokens (`--joy-palette-primary-mainChannel`
 * and friends) by parsing these strings, and a `var()` there produces
 * unusable channels. The provider rebuilds this (memoized) when the theme
 * changes, which is cheap: Joy regenerates one stylesheet.
 */
export const buildJoyTheme = (
    themeId: ThemeId = DEFAULT_THEME_ID,
    // Joy reads `direction` for the handful of components that position
    // themselves relative to the reading order (Select/Menu popper
    // placement, Drawer anchor). The bulk of the mirroring is done by the
    // emotion plugin in `rtlCache.ts`; this covers what the plugin can't,
    // because it isn't expressed as CSS.
    direction: "ltr" | "rtl" = "ltr"
) => {
    const { ramp, brandRgb } = THEME_PRIMITIVES[themeId];
    const soft = (alpha: number) => `rgba(${brandRgb}, ${alpha})`;
    return extendTheme({
        direction,
        colorSchemes: {
            dark: {
                palette: {
                    primary: {
                        ...ramp,
                        solidBg: "var(--joy-palette-primary-600)",
                        solidHoverBg: "var(--joy-palette-primary-500)",
                        solidActiveBg: "var(--joy-palette-primary-700)",
                        outlinedBorder: "var(--joy-palette-primary-700)",
                        outlinedColor: "var(--joy-palette-primary-300)",
                        outlinedHoverBg: "var(--joy-palette-primary-800)",
                        outlinedActiveBg: "var(--joy-palette-primary-900)",
                        softColor: "var(--joy-palette-primary-200)",
                        softBg: soft(0.18),
                        softHoverBg: soft(0.28),
                        softActiveBg: soft(0.35),
                        plainColor: "var(--joy-palette-primary-300)",
                        plainHoverBg: soft(0.12),
                        plainActiveBg: soft(0.2),
                    },
                },
            },
            light: {
                palette: {
                    primary: {
                        ...ramp,
                        solidBg: "var(--joy-palette-primary-700)",
                        solidHoverBg: "var(--joy-palette-primary-600)",
                        solidActiveBg: "var(--joy-palette-primary-800)",
                        outlinedBorder: "var(--joy-palette-primary-500)",
                        outlinedColor: "var(--joy-palette-primary-700)",
                        outlinedHoverBg: "var(--joy-palette-primary-100)",
                        outlinedActiveBg: "var(--joy-palette-primary-200)",
                        softColor: "var(--joy-palette-primary-800)",
                        softBg: "var(--joy-palette-primary-100)",
                        softHoverBg: "var(--joy-palette-primary-200)",
                        softActiveBg: soft(0.25),
                        plainColor: "var(--joy-palette-primary-700)",
                        plainHoverBg: "var(--joy-palette-primary-100)",
                        plainActiveBg: "var(--joy-palette-primary-200)",
                    },
                },
            },
        },
        // Tooltips portal to <body> at the Joy `tooltip` z-index token (default
        // 1550). Several app surfaces use much higher hardcoded z-indexes —
        // ServiceSwitcherOverlay (13000), the Spotlight overlay (13100) and the
        // citation-preview UrlLinkModal (13200) — so a tooltip opened from inside
        // any of them rendered BEHIND the overlay. Lift the token above all of
        // them so tooltips stay topmost everywhere. (Relative order vs Joy's
        // menus/modals/snackbars is unchanged — the token was already above those.)
        zIndex: {
            tooltip: 13300,
        },
    });
};
