/**
 * The design-system review page (MIP-1106) renders, and its preview
 * controls re-point the token wrapper without touching the user's saved
 * theme. Layout and color are checked by screenshot, not here (jsdom has
 * no layout); this guards the wiring.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DesignSystemPage from "../features/designSystem/DesignSystemPage";
import { buildJoyTheme } from "../theme/purplePalette";
import { THEME_STORAGE_KEY } from "../theme/themeStyles";
import { installDesignTokens } from "../theme/tokens/tokenStyles";

const renderPage = () =>
    render(
        <CssVarsProvider theme={buildJoyTheme("purple")}>
            <DesignSystemPage />
        </CssVarsProvider>
    );

const wrapper = (container: HTMLElement) =>
    container.querySelector("[data-g-theme] > header")!.parentElement!;

describe("DesignSystemPage", () => {
    it("renders every section and one cell per theme × mode", () => {
        const { container } = renderPage();
        for (const title of [
            "Every theme",
            "Color roles",
            "Type",
            "Shape, depth and motion",
            "Components",
        ]) {
            // Plain DOM queries: getByRole walks this large page's whole
            // accessibility tree and is slow enough to time out under load.
            const headings = Array.from(container.querySelectorAll("h2"), (h) => h.textContent);
            expect(headings).toContain(title);
        }
        // 7 themes × 2 modes, plus the page wrapper itself.
        expect(container.querySelectorAll("[data-g-theme][data-g-mode]")).toHaveLength(15);
    });

    it("installs the token stylesheet once, however often it is asked", () => {
        // Importing the page already installed it; start from none so the
        // guard itself is what's tested.
        document.getElementById("genos-design-tokens")?.remove();
        installDesignTokens();
        installDesignTokens();
        expect(document.querySelectorAll("#genos-design-tokens")).toHaveLength(1);
    });

    it("gives every matrix cell its own Joy bridge, not the page's", () => {
        const { container } = renderPage();
        const cell = container.querySelector(
            '[data-g-theme="teal"][data-g-mode="dark"]'
        ) as HTMLElement;
        // The bridge is emitted as a class rule; jsdom resolves it into
        // the computed style, so the cell must declare the variable itself.
        expect(getComputedStyle(cell).getPropertyValue("--joy-palette-text-primary").trim()).toBe(
            "var(--g-text)"
        );
        expect(getComputedStyle(cell).colorScheme).toBe("dark");
    });

    it("previews another theme and mode without saving them", () => {
        localStorage.removeItem(THEME_STORAGE_KEY);
        const { container } = renderPage();
        const header = container.querySelector("[data-g-theme] > header")!;
        const button = (label: string) =>
            Array.from(header.querySelectorAll("button")).find(
                (b) => b.getAttribute("aria-label") === label || b.textContent === label
            )!;
        fireEvent.click(button("Teal"));
        fireEvent.click(button("Dark"));
        const el = wrapper(container);
        expect(el.dataset.gTheme).toBe("teal");
        expect(el.dataset.gMode).toBe("dark");
        expect(button("Teal").getAttribute("aria-pressed")).toBe("true");
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });
});
