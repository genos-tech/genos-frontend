/**
 * The design-system review page (MIP-1106) renders, and its preview
 * controls re-point the token wrapper without touching the user's saved
 * theme. Layout and color are checked by screenshot, not here (jsdom has
 * no layout); this guards the wiring.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DesignSystemPage from "../features/designSystem/DesignSystemPage";
import { buildJoyTheme } from "../theme/purplePalette";
import { THEME_STORAGE_KEY } from "../theme/themeStyles";

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
            expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
        }
        // 7 themes × 2 modes, plus the page wrapper itself.
        expect(container.querySelectorAll("[data-g-theme][data-g-mode]")).toHaveLength(15);
    });

    it("installs the token stylesheet once", () => {
        renderPage();
        renderPage();
        expect(document.querySelectorAll("#genos-design-tokens")).toHaveLength(1);
    });

    it("previews another theme and mode without saving them", () => {
        localStorage.removeItem(THEME_STORAGE_KEY);
        const { container } = renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Teal" }));
        fireEvent.click(screen.getByRole("button", { name: "Dark" }));
        const el = wrapper(container);
        expect(el.dataset.gTheme).toBe("teal");
        expect(el.dataset.gMode).toBe("dark");
        expect(screen.getByRole("button", { name: "Teal" }).getAttribute("aria-pressed")).toBe(
            "true"
        );
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });
});
