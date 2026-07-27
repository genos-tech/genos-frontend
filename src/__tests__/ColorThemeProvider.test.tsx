/**
 * The live theme switch.
 *
 * Splitting the verification: a real browser confirmed that a given
 * `data-theme` value resolves every `--gp-*` variable to that theme's
 * colors (and that Joy's `primary` ramp follows when the provider boots
 * with it). jsdom can't compute `var()`, so what's left to pin down here
 * is the *mechanism* — that selecting a theme writes the attribute the
 * browser keys on, and persists it for the next load.
 *
 * The attribute write is the entire repaint path. `commonStyle.ts` froze
 * its 14 style objects at module load and no React render can revisit
 * them, so if `setThemeId` ever stopped touching `<html>`, the app would
 * silently keep the old colors while the picker showed the new one.
 */

import { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ColorThemeProvider, useColorTheme } from "../theme/ColorThemeProvider";
import { DEFAULT_THEME_ID, THEME_PRIMITIVES } from "../theme/themePalettes";
import { THEME_STORAGE_KEY } from "../theme/themeStyles";

let api: ReturnType<typeof useColorTheme>;

const Probe = () => {
    api = useColorTheme();
    return <span data-testid="theme">{api.themeId}</span>;
};

const mount = (children: ReactNode = <Probe />) =>
    render(<ColorThemeProvider>{children}</ColorThemeProvider>);

beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
});

describe("ColorThemeProvider", () => {
    it("installs the variable stylesheet once", () => {
        mount();
        const tags = document.querySelectorAll("#genos-theme-vars");
        expect(tags).toHaveLength(1);
        expect(tags[0].textContent).toContain("--gp-brand-700");
        // Remounting must not append a second copy.
        mount();
        expect(document.querySelectorAll("#genos-theme-vars")).toHaveLength(1);
    });

    it("points <html> at the selected theme and persists the choice", () => {
        mount();
        expect(screen.getByTestId("theme")).toHaveTextContent(DEFAULT_THEME_ID);

        act(() => api.setThemeId("emerald"));

        // The attribute write IS the repaint — see the note above.
        expect(document.documentElement.dataset.theme).toBe("emerald");
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("emerald");
        expect(screen.getByTestId("theme")).toHaveTextContent("emerald");
    });

    it("exposes the selected theme's RAW colors for non-CSS sinks", () => {
        mount();
        act(() => api.setThemeId("rose"));
        // React Flow's MiniMap writes this into an SVG fill attribute, which
        // never resolves a var() — so it has to be a real color.
        expect(api.raw).toBe(THEME_PRIMITIVES.rose);
        expect(api.raw.dark.accent).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("ignores a corrupt stored theme rather than rendering unresolved vars", () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, "chartreuse");
        mount();
        expect(screen.getByTestId("theme")).toHaveTextContent(DEFAULT_THEME_ID);
    });

    it("serves the default outside a provider so unwrapped trees still get real colors", () => {
        const Bare = () => {
            const { themeId, raw } = useColorTheme();
            return <span data-testid="bare">{`${themeId}:${raw.dark.accent}`}</span>;
        };
        render(<Bare />);
        expect(screen.getByTestId("bare")).toHaveTextContent(
            `${DEFAULT_THEME_ID}:${THEME_PRIMITIVES[DEFAULT_THEME_ID].dark.accent}`
        );
    });
});
