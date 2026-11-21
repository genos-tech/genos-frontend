/**
 * MIP-1851: the public header fits a narrow window (a 390 px phone at 200% text is 195 CSS px).
 *
 * jsdom has no layout, so the width rules are checked as CSS text: the language switch leaves
 * the header below 480 px and appears in the menu instead, and the app's body min-width is
 * lifted only while a marketing page is mounted. The layout itself is measured in a browser
 * (see the PR body for the widths checked).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import LandingPage from "../lp/LandingPage";

const CSS = readFileSync(resolve(__dirname, "../lp/kit/lp.css"), "utf8");

const renderLanding = () =>
    render(
        <MemoryRouter initialEntries={["/home"]}>
            <LandingPage />
        </MemoryRouter>
    );

describe("MIP-1851 narrow public header", () => {
    it("renders the language switch in the header and again in the menu", async () => {
        const user = userEvent.setup();
        const { container, unmount } = renderLanding();

        expect(container.querySelectorAll(".lp-header .lp-seg")).toHaveLength(1);
        expect(container.querySelector(".lp-header .lp-header__lang")).not.toBeNull();
        expect(container.querySelector(".lp-menu")).toBeNull();

        await user.click(screen.getByRole("button", { name: /^menu$/i }));

        const menuSwitch = container.querySelector(".lp-menu .lp-seg");
        expect(menuSwitch).not.toBeNull();
        expect(menuSwitch?.classList.contains("lp-menu__lang")).toBe(true);
        expect(menuSwitch?.querySelectorAll("button")).toHaveLength(2);
        unmount();
    });

    it("hides the header language switch below 480 px and shows the menu one there", () => {
        expect(CSS).toMatch(
            /@media \(max-width: 480px\) \{[^}]*\.lp-header__row \{[^}]*gap: 12px;[\s\S]*?\.lp-header__lang \{\s*display: none;/
        );
        expect(CSS).toMatch(
            /@media \(max-width: 480px\) \{[\s\S]*?\.lp-menu__lang \{\s*display: inline-flex;/
        );
    });

    it("drops the wordmark text to the logo mark below 360 px, keeping the link name", () => {
        expect(CSS).toMatch(
            /@media \(max-width: 360px\) \{\s*\.lp-logo__name \{\s*display: none;/
        );
        const { container, unmount } = renderLanding();
        const logo = container.querySelector("header .lp-logo");
        expect(logo?.getAttribute("aria-label")).toBe("Genos");
        expect(logo?.querySelector(".lp-logo__name")?.textContent).toBe("Genos");
        unmount();
    });

    it("lifts the app's body min-width only while a marketing page is mounted", () => {
        expect(CSS).toMatch(/body\.lp-body \{\s*min-width: 0;/);
        const { unmount } = renderLanding();
        expect(document.body.classList.contains("lp-body")).toBe(true);
        unmount();
        expect(document.body.classList.contains("lp-body")).toBe(false);
    });

    it("gives the header controls a 44 px touch target on coarse pointers", () => {
        expect(CSS).toMatch(
            /@media \(pointer: coarse\) \{[\s\S]*?\.lp-header \.lp-icon-btn \{[^}]*width: 44px;[^}]*height: 44px;/
        );
    });
});
