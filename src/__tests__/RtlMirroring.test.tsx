import { CacheProvider } from "@emotion/react";
import { Box } from "@mui/joy";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { applyDocumentLocale, getDocumentDirection, subscribeDocumentDirection } from "../i18n";
import { ColorThemeProvider } from "../theme/ColorThemeProvider";
import { buildJoyTheme } from "../theme/purplePalette";
import { getRtlCache, RTL_CACHE_KEY } from "../theme/rtlCache";

afterEach(() => {
    // Leave the document back on LTR so ordering between files can't matter.
    applyDocumentLocale("en");
    document.documentElement.dir = "";
});

describe("document direction as a subscribable value", () => {
    it("tracks the locale", () => {
        applyDocumentLocale("ar");
        expect(getDocumentDirection()).toBe("rtl");
        applyDocumentLocale("ja");
        expect(getDocumentDirection()).toBe("ltr");
    });

    it("notifies subscribers on a change, and only on a change", () => {
        // `ColorThemeProvider` sits ABOVE `I18nProvider` (it renders
        // CssVarsProvider), so it can't read the locale from context — this
        // subscription is how it learns about a language switch at all.
        applyDocumentLocale("en");
        const seen: string[] = [];
        const stop = subscribeDocumentDirection((d) => seen.push(d));

        applyDocumentLocale("ar");
        applyDocumentLocale("ar"); // same direction — must not re-notify
        applyDocumentLocale("fr");

        stop();
        applyDocumentLocale("ar"); // after unsubscribe — must not arrive
        expect(seen).toEqual(["rtl", "ltr"]);
    });
});

describe("the RTL emotion cache", () => {
    it("uses its own key so it can't collide with the default cache", () => {
        expect(getRtlCache().key).toBe(RTL_CACHE_KEY);
        expect(RTL_CACHE_KEY).not.toBe("css");
    });

    it("is memoised — createCache injects a style container per call", () => {
        expect(getRtlCache()).toBe(getRtlCache());
    });

    it("MIRRORS physical CSS, which is the entire point", () => {
        // `dir="rtl"` cannot flip `marginLeft` — that's why ~180 `ml`/`pr`
        // shorthands left Arabic half-mirrored. This asserts the plugin
        // actually rewrites the declaration emotion produces.
        render(
            <CacheProvider value={getRtlCache()}>
                <Box data-testid="probe" sx={{ marginLeft: "40px", paddingRight: "8px" }} />
            </CacheProvider>
        );
        const style = getComputedStyle(screen.getByTestId("probe"));
        expect(style.marginRight).toBe("40px");
        // jsdom spells an unset margin "0", not "0px".
        expect(["0", "0px"]).toContain(style.marginLeft);
        expect(style.paddingLeft).toBe("8px");
    });

    it("leaves logical properties alone", () => {
        // `App.css` was converted to these precisely so the browser handles
        // them; double-flipping would undo that.
        render(
            <CacheProvider value={getRtlCache()}>
                <Box data-testid="logical" sx={{ paddingInlineStart: "12px" }} />
            </CacheProvider>
        );
        expect(getComputedStyle(screen.getByTestId("logical")).paddingInlineStart).toBe("12px");
    });
});

describe("buildJoyTheme direction", () => {
    it("defaults to ltr", () => {
        expect(buildJoyTheme().direction).toBe("ltr");
    });

    it("carries rtl through, for the components that position by reading order", () => {
        expect(buildJoyTheme(undefined, "rtl").direction).toBe("rtl");
    });
});

describe("ColorThemeProvider", () => {
    /** Emotion prefixes generated class names with its cache key, so the key
     *  in the rendered markup tells us which cache was used. */
    const usedRtlCache = (el: HTMLElement) => el.className.includes(`${RTL_CACHE_KEY}-`);

    it("does NOT mount the RTL cache for a left-to-right locale", () => {
        // The blast-radius guarantee: six of seven locales must render the
        // exact tree they did before this feature existed.
        applyDocumentLocale("en");
        render(
            <ColorThemeProvider>
                <Box data-testid="ltr-child" sx={{ marginLeft: "40px" }} />
            </ColorThemeProvider>
        );
        expect(usedRtlCache(screen.getByTestId("ltr-child"))).toBe(false);
    });

    it("mounts the RTL cache for Arabic", () => {
        applyDocumentLocale("ar");
        render(
            <ColorThemeProvider>
                <Box data-testid="rtl-child" sx={{ marginLeft: "40px" }} />
            </ColorThemeProvider>
        );
        expect(usedRtlCache(screen.getByTestId("rtl-child"))).toBe(true);
    });
});
