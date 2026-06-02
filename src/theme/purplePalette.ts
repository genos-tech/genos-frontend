import { extendTheme } from "@mui/joy/styles";

// Deep royal purple base palette. The single source of truth for brand-surface
// colors across `components/ui/styles/commonStyle.ts` and every feature in
// `features/*`. Functional/data colors (task status, priority flags, the tag
// picker, online-status indicator) intentionally bypass this palette.

export type PurpleTokens = {
    // Surfaces
    bg: string;
    surface: string;
    surfaceElevated: string;
    surfaceSolid: string;

    // Accent (purple)
    accent: string;
    accentStrong: string;
    accentSoft: string;
    accentMuted: string;

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

    // Semantic tints (all purple-shifted — see palette doctrine above)
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

export const purplePalette: { dark: PurpleTokens; light: PurpleTokens } = {
    dark: {
        // Surfaces
        bg: "#0b0a16",
        surface: "linear-gradient(145deg, rgba(30,20,46,0.95) 0%, rgba(20,14,34,0.98) 100%)",
        surfaceElevated:
            "linear-gradient(135deg, rgba(40,28,60,0.9) 0%, rgba(30,20,46,0.95) 100%)",
        surfaceSolid: "rgba(30,20,46,0.95)",

        // Accent
        accent: "#8b5cf6",
        accentStrong: "#7c3aed",
        accentSoft: "#a78bfa",
        accentMuted: "#c084fc",

        // Gradients
        accentGradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
        accentGradientHover: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        titleGradient: "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #c084fc 100%)",

        // Structure
        border: "rgba(124,58,237,0.2)",
        borderStrong: "rgba(124,58,237,0.35)",
        borderMuted: "rgba(124,58,237,0.12)",
        divider: "rgba(124,58,237,0.12)",

        // Text
        text: "#f1f5f9",
        textMuted: "rgba(168,168,200,0.9)",
        textSubtle: "rgba(148,148,180,0.7)",

        // Semantic tints
        dangerTint: "#e879c3",
        dangerTintBg:
            "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
        dangerTintBgHover:
            "linear-gradient(135deg, rgba(232,121,195,0.25) 0%, rgba(192,38,168,0.25) 100%)",
        dangerTintBorder: "rgba(232,121,195,0.3)",

        successTint: "#c084fc",
        successTintBg:
            "linear-gradient(135deg, rgba(192,132,252,0.12) 0%, rgba(168,85,247,0.12) 100%)",
        successTintBorder: "rgba(192,132,252,0.3)",

        warningTint: "#d8b4fe",
        warningTintBg:
            "linear-gradient(135deg, rgba(216,180,254,0.12) 0%, rgba(168,85,247,0.12) 100%)",
        warningTintBorder: "rgba(216,180,254,0.3)",

        // Effects
        glow: "rgba(124,58,237,0.25)",
        shadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(124,58,237,0.12)",
        shadowSoft: "0 4px 16px rgba(124,58,237,0.4)",

        // Inputs
        inputBg: "rgba(15,10,24,0.4)",
        inputBorder: "rgba(124,58,237,0.2)",
        inputFocusBorder: "#a78bfa",
        inputFocusShadow: "0 0 0 3px rgba(124,58,237,0.25)",

        // Hover / pressed
        hoverBg: "rgba(124,58,237,0.15)",
        activeBg: "rgba(124,58,237,0.25)",

        // Chip / badge
        chipBg: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        chipBorder: "rgba(124,58,237,0.3)",

        // Buttons
        buttonBg: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        buttonBgHover:
            "linear-gradient(135deg, rgba(124,58,237,0.28) 0%, rgba(139,92,246,0.28) 100%)",
        buttonBorder: "rgba(124,58,237,0.3)",
        primaryButtonBg: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
        primaryButtonHover: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        primaryButtonShadow: "0 4px 16px rgba(124,58,237,0.4)",

        // Menus
        menuBg: "linear-gradient(180deg, rgba(30,20,46,0.98) 0%, rgba(20,14,34,0.99) 100%)",
        menuBorder: "rgba(124,58,237,0.18)",
    },
    light: {
        // Surfaces
        bg: "#faf9ff",
        surface: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,245,255,0.99) 100%)",
        surfaceElevated:
            "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245,240,255,0.92) 100%)",
        surfaceSolid: "rgba(255,255,255,0.98)",

        // Accent
        accent: "#7c3aed",
        accentStrong: "#6d28d9",
        accentSoft: "#9333ea",
        accentMuted: "#a855f7",

        // Gradients
        accentGradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
        accentGradientHover: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        titleGradient: "linear-gradient(90deg, #6d28d9 0%, #7c3aed 50%, #9333ea 100%)",

        // Structure
        border: "rgba(124,58,237,0.15)",
        borderStrong: "rgba(124,58,237,0.25)",
        borderMuted: "rgba(124,58,237,0.08)",
        divider: "rgba(124,58,237,0.1)",

        // Text
        text: "#1e293b",
        textMuted: "rgba(100,90,130,0.9)",
        textSubtle: "rgba(120,110,150,0.7)",

        // Semantic tints
        dangerTint: "#c026a8",
        dangerTintBg:
            "linear-gradient(135deg, rgba(192,38,168,0.08) 0%, rgba(157,23,148,0.08) 100%)",
        dangerTintBgHover:
            "linear-gradient(135deg, rgba(192,38,168,0.15) 0%, rgba(157,23,148,0.15) 100%)",
        dangerTintBorder: "rgba(192,38,168,0.2)",

        successTint: "#9333ea",
        successTintBg:
            "linear-gradient(135deg, rgba(147,51,234,0.08) 0%, rgba(126,34,206,0.08) 100%)",
        successTintBorder: "rgba(147,51,234,0.2)",

        warningTint: "#a855f7",
        warningTintBg:
            "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        warningTintBorder: "rgba(168,85,247,0.2)",

        // Effects
        glow: "rgba(124,58,237,0.15)",
        shadow: "0 8px 32px rgba(124,58,237,0.12), 0 0 60px rgba(124,58,237,0.05)",
        shadowSoft: "0 4px 16px rgba(124,58,237,0.3)",

        // Inputs
        inputBg: "rgba(255,255,255,0.92)",
        inputBorder: "rgba(124,58,237,0.2)",
        inputFocusBorder: "#7c3aed",
        inputFocusShadow: "0 0 0 3px rgba(124,58,237,0.12)",

        // Hover / pressed
        hoverBg: "rgba(124,58,237,0.08)",
        activeBg: "rgba(124,58,237,0.15)",

        // Chip / badge
        chipBg: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        chipBorder: "rgba(124,58,237,0.2)",

        // Buttons
        buttonBg: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        buttonBgHover:
            "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(139,92,246,0.18) 100%)",
        buttonBorder: "rgba(124,58,237,0.2)",
        primaryButtonBg: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
        primaryButtonHover: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        primaryButtonShadow: "0 4px 16px rgba(124,58,237,0.3)",

        // Menus
        menuBg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,245,255,0.99) 100%)",
        menuBorder: "rgba(124,58,237,0.12)",
    },
};

// Joy UI theme extension. Wires the same deep-royal-purple ramp into Joy's
// `primary` palette so any component using `color="primary"` picks up the
// brand automatically, without touching its sx prop.
export const purpleTheme = extendTheme({
    colorSchemes: {
        dark: {
            palette: {
                primary: {
                    50: "#faf5ff",
                    100: "#f3e8ff",
                    200: "#e9d5ff",
                    300: "#d8b4fe",
                    400: "#c084fc",
                    500: "#a855f7",
                    600: "#9333ea",
                    700: "#7c3aed",
                    800: "#6d28d9",
                    900: "#5b21b6",
                    solidBg: "var(--joy-palette-primary-600)",
                    solidHoverBg: "var(--joy-palette-primary-500)",
                    solidActiveBg: "var(--joy-palette-primary-700)",
                    outlinedBorder: "var(--joy-palette-primary-700)",
                    outlinedColor: "var(--joy-palette-primary-300)",
                    outlinedHoverBg: "var(--joy-palette-primary-800)",
                    outlinedActiveBg: "var(--joy-palette-primary-900)",
                    softColor: "var(--joy-palette-primary-200)",
                    softBg: "rgba(124,58,237,0.18)",
                    softHoverBg: "rgba(124,58,237,0.28)",
                    softActiveBg: "rgba(124,58,237,0.35)",
                    plainColor: "var(--joy-palette-primary-300)",
                    plainHoverBg: "rgba(124,58,237,0.12)",
                    plainActiveBg: "rgba(124,58,237,0.2)",
                },
            },
        },
        light: {
            palette: {
                primary: {
                    50: "#faf5ff",
                    100: "#f3e8ff",
                    200: "#e9d5ff",
                    300: "#d8b4fe",
                    400: "#c084fc",
                    500: "#a855f7",
                    600: "#9333ea",
                    700: "#7c3aed",
                    800: "#6d28d9",
                    900: "#5b21b6",
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
                    softActiveBg: "rgba(168,85,247,0.25)",
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
