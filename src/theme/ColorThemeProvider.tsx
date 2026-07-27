import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";

import { buildJoyTheme } from "./purplePalette";
import { DEFAULT_THEME_ID, THEME_PRIMITIVES, ThemeId, ThemePrimitives } from "./themePalettes";
import { applyThemeId, installActiveTheme, storeThemeId } from "./themeStyles";

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

const INITIAL_THEME_ID = installActiveTheme();

interface ColorThemeContextValue {
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

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

export const ColorThemeProvider = ({ children }: { children: ReactNode }) => {
    const [themeId, setThemeIdState] = useState<ThemeId>(INITIAL_THEME_ID);

    const setThemeId = useCallback((id: ThemeId) => {
        setThemeIdState(id);
        applyThemeId(id);
        storeThemeId(id);
    }, []);

    // Memoized per theme: `extendTheme` regenerates Joy's whole stylesheet,
    // which must not happen on every parent render.
    const joyTheme = useMemo(() => buildJoyTheme(themeId), [themeId]);

    const value = useMemo<ColorThemeContextValue>(
        () => ({ themeId, setThemeId, raw: THEME_PRIMITIVES[themeId] }),
        [themeId, setThemeId]
    );

    return (
        <ColorThemeContext.Provider value={value}>
            <CssVarsProvider theme={joyTheme} disableTransitionOnChange>
                {children}
            </CssVarsProvider>
        </ColorThemeContext.Provider>
    );
};

export const useColorTheme = (): ColorThemeContextValue => {
    const ctx = useContext(ColorThemeContext);
    if (!ctx) {
        // Provider not mounted (unit tests, pre-auth shells). Serve the
        // default so callers reading `raw` still get real colors.
        return {
            themeId: DEFAULT_THEME_ID,
            setThemeId: () => {},
            raw: THEME_PRIMITIVES[DEFAULT_THEME_ID],
        };
    }
    return ctx;
};
