import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";

import { Direction, getDocumentDirection, subscribeDocumentDirection } from "../i18n";
import { buildJoyTheme } from "./purplePalette";
import { getRtlCache } from "./rtlCache";
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

    // Reading direction, tracked here because this provider renders
    // `CssVarsProvider` and therefore sits ABOVE `I18nProvider` — it can't
    // call `useTranslation()`. `i18n/types.ts` is already the single place
    // that writes `<html dir>`, so it publishes the change too.
    const [direction, setDirection] = useState<Direction>(getDocumentDirection);
    useEffect(() => subscribeDocumentDirection(setDirection), []);

    // Memoized per theme: `extendTheme` regenerates Joy's whole stylesheet,
    // which must not happen on every parent render.
    const joyTheme = useMemo(() => buildJoyTheme(themeId, direction), [themeId, direction]);

    const value = useMemo<ColorThemeContextValue>(
        () => ({ themeId, setThemeId, raw: THEME_PRIMITIVES[themeId] }),
        [themeId, setThemeId]
    );

    const themed = (
        <CssVarsProvider theme={joyTheme} disableTransitionOnChange>
            {children}
        </CssVarsProvider>
    );

    return (
        <ColorThemeContext.Provider value={value}>
            {/* The RTL emotion cache is mounted ONLY for a right-to-left
                locale. LTR keeps emotion's default cache untouched, so for
                six of the seven locales — everyone but Arabic — this file
                renders exactly the tree it did before, and the blast radius
                of the mirroring work is limited to the locale that needs it.
                See `rtlCache.ts` for why the plugin is required at all. */}
            {direction === "rtl" ? (
                <CacheProvider value={getRtlCache()}>{themed}</CacheProvider>
            ) : (
                themed
            )}
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
