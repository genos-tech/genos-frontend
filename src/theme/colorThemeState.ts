import { createContext, useContext } from "react";

import { DEFAULT_THEME_ID, ThemeId, ThemePrimitives } from "./themePalettes";
import { installActiveTheme } from "./themeStyles";
import { resolvedPrimitives } from "./tokens/primitives";
import { installDesignTokens } from "./tokens/tokenStyles";

/**
 * Owns which color theme is active.
 *
 * Two things have to move when the user picks a theme:
 *
 *  1. The `data-theme` attribute on `<html>`, which re-points every
 *     `var(--gp-…)` in `purplePalette.ts`. This is what repaints the app —
 *     no React render involved, which is the only reason the frozen
 *     objects in `commonStyle.ts` can follow along.
 *  2. Joy's `primary` palette, which needs REAL hex (see `buildJoyTheme`).
 *     That means rebuilding the Joy theme object, so this provider also
 *     renders `CssVarsProvider` — and therefore must sit ABOVE it in the
 *     tree. `useThemePreference` (light/dark/system) stays below, since it
 *     calls `useColorScheme` and needs Joy's context.
 *
 * The stylesheet is installed at MODULE IMPORT, before React mounts, so a
 * saved non-default theme never flashes purple on first paint.
 */

export const INITIAL_THEME_ID = installActiveTheme();
// The `--g-*` design tokens (MIP-1106). Same timing and reason: before React
// mounts, so the first paint already has them.
installDesignTokens();

export interface ColorThemeContextValue {
    themeId: ThemeId;
    setThemeId: (id: ThemeId) => void;
    /**
     * The active theme's RAW values — real colors, not `var()` references.
     *
     * ONLY for sinks that can't resolve a CSS variable: third-party APIs
     * that put a color into an SVG presentation attribute (React Flow's
     * `MiniMap nodeColor`), canvas, or JS color math. Everything that ends
     * up in `sx` / `style` / CSS must keep using `purplePalette` so it
     * stays a single indirection.
     */
    raw: ThemePrimitives;
}

export const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

export const useColorTheme = (): ColorThemeContextValue => {
    const ctx = useContext(ColorThemeContext);
    if (!ctx) {
        // Provider not mounted (unit tests, pre-auth shells). Serve the
        // default so callers reading `raw` still get real colors.
        return {
            themeId: DEFAULT_THEME_ID,
            setThemeId: () => {},
            raw: resolvedPrimitives(DEFAULT_THEME_ID),
        };
    }
    return ctx;
};
