/**
 * MIP-1867: a public (marketing) page opened from another page starts at the top, not at
 * the scroll position of the page it was opened from. The footer "Privacy" link used to open
 * /privacy scrolled to the bottom: React Router changes the route and keeps window scroll.
 *
 * Pinned through LpShell, which every public page renders: a route change lands at the top and
 * moves focus to <main> without scrolling; a hash lands on its anchor; Back restores the saved
 * position; reduced motion makes the anchor scroll instant.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LandingPage from "../lp/LandingPage";
import PrivacyPage from "../lp/PrivacyPage";

const setScrollY = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
    window.dispatchEvent(new Event("scroll"));
};

const stubReducedMotion = (reduce: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" && reduce,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
};

let go: ((delta: number) => void) | null = null;
/** Exposes react-router's navigate so a test can go Back without a link. */
function NavProbe() {
    const navigate = useNavigate();
    go = (delta) => navigate(delta);
    return null;
}

const renderSite = (entry: string) =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <NavProbe />
            <Routes>
                <Route element={<LandingPage />} path="/home" />
                <Route element={<PrivacyPage />} path="/privacy" />
            </Routes>
            <Link to="/privacy#section-x">jump</Link>
        </MemoryRouter>
    );

const footerLink = (href: string) => {
    const link = document.querySelector(`footer a[href="${href}"]`);
    expect(link, `footer link ${href}`).not.toBeNull();
    return link as HTMLElement;
};

describe("public pages: a route change starts at the top", () => {
    let scrollTo: ReturnType<typeof vi.fn>;
    let scrollIntoView: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        stubReducedMotion(false);
        go = null;
        // jsdom implements neither; the spies record what the page asked for.
        scrollTo = vi.fn();
        scrollIntoView = vi.fn();
        window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
        Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
    });

    afterEach(() => {
        setScrollY(0);
        document.body.innerHTML = "";
    });

    it("the footer Privacy link opens /privacy at the top and focuses <main>", async () => {
        const user = userEvent.setup();
        renderSite("/home");
        setScrollY(4000); // the visitor scrolled to the footer of the home page
        scrollTo.mockClear();

        await user.click(footerLink("/privacy"));

        expect(screen.getByText("プライバシーポリシー")).toBeTruthy();
        expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: 0, behavior: "auto" })
        );
        expect(document.activeElement).toBe(document.getElementById("lp-main"));
    });

    it("a hash link lands on its anchor, not on the top", async () => {
        const user = userEvent.setup();
        renderSite("/home");
        const anchor = document.createElement("div");
        anchor.id = "section-x";
        document.body.appendChild(anchor);
        scrollTo.mockClear();

        await user.click(screen.getByText("jump"));

        expect(scrollIntoView).toHaveBeenLastCalledWith(
            expect.objectContaining({ block: "start", behavior: "smooth" })
        );
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("Back restores the position the visitor left the previous page at", async () => {
        const user = userEvent.setup();
        renderSite("/home");
        setScrollY(1234);
        await user.click(footerLink("/privacy"));
        expect(screen.getByText("プライバシーポリシー")).toBeTruthy();
        setScrollY(0);
        scrollTo.mockClear();

        await act(async () => {
            go?.(-1);
        });

        expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: 1234, behavior: "auto" })
        );
    });

    it("reduced motion: the anchor scroll is instant", async () => {
        stubReducedMotion(true);
        const user = userEvent.setup();
        renderSite("/home");
        const anchor = document.createElement("div");
        anchor.id = "section-x";
        document.body.appendChild(anchor);

        await user.click(screen.getByText("jump"));

        expect(scrollIntoView).toHaveBeenLastCalledWith(
            expect.objectContaining({ behavior: "auto" })
        );
    });
});
