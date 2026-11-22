import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";

import { Direction, getDocumentDirection, subscribeDocumentDirection } from "../i18n";
import { ColorThemeContext, ColorThemeContextValue, INITIAL_THEME_ID } from "./colorThemeState";
import { buildJoyTheme } from "./purplePalette";
import { getRtlCache } from "./rtlCache";
import { ThemeId } from "./themePalettes";
import { applyThemeId, storeThemeId } from "./themeStyles";
import { resolvedPrimitives } from "./tokens/primitives";

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
        () => ({ themeId, setThemeId, raw: resolvedPrimitives(themeId) }),
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
