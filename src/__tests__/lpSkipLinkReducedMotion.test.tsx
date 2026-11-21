/**
 * MIP-1829: every public marketing page (src/lp/**) has a skip link that moves keyboard
 * focus to its <main>, and the marketing CSS turns motion off under prefers-reduced-motion.
 *
 * The skip link is checked by keyboard, not by its href alone: Tab must land on it first,
 * and Enter must move focus into <main> (a non-focusable <main> does not take focus from a
 * fragment link in every browser, so <main> carries tabIndex -1).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AccessibilityPage from "../lp/AccessibilityPage";
import BlogArticlePage from "../lp/BlogArticlePage";
import BlogPage from "../lp/BlogPage";
import ChangelogPage from "../lp/ChangelogPage";
import ContactPage from "../lp/ContactPage";
import DemoPage from "../lp/DemoPage";
import DevelopersPage from "../lp/DevelopersPage";
import DocsPage from "../lp/DocsPage";
import FeaturesPage from "../lp/FeaturesPage";
import LandingPage from "../lp/LandingPage";
import LegalPage from "../lp/LegalPage";
import MigratePage from "../lp/MigratePage";
import PlansPage from "../lp/PlansPage";
import PrivacyPage from "../lp/PrivacyPage";
import SecurityPage from "../lp/SecurityPage";
import SegmentLandingPage from "../lp/SegmentLandingPage";
import SupportPage from "../lp/SupportPage";

const CSS_PATH = resolve(__dirname, "../lp/kit/lp.css");

interface PublicPage {
    name: string;
    entry: string;
    path: string;
    element: ReactElement;
}

const PUBLIC_PAGES: PublicPage[] = [
    { name: "landing", entry: "/", path: "/", element: <LandingPage /> },
    {
        name: "features",
        entry: "/features-guide",
        path: "/features-guide",
        element: <FeaturesPage />,
    },
    { name: "demo", entry: "/demo-guide", path: "/demo-guide", element: <DemoPage /> },
    { name: "plans", entry: "/plans", path: "/plans", element: <PlansPage /> },
    { name: "blog", entry: "/blog", path: "/blog", element: <BlogPage /> },
    {
        name: "blog article",
        entry: "/blog/ai-can-search-your-tools",
        path: "/blog/:slug",
        element: <BlogArticlePage />,
    },
    { name: "legal", entry: "/legal", path: "/legal", element: <LegalPage /> },
    { name: "developers", entry: "/developers", path: "/developers", element: <DevelopersPage /> },
    { name: "privacy", entry: "/privacy", path: "/privacy", element: <PrivacyPage /> },
    { name: "contact", entry: "/contact", path: "/contact", element: <ContactPage /> },
    { name: "support", entry: "/support", path: "/support", element: <SupportPage /> },
    { name: "migrate", entry: "/migrate", path: "/migrate", element: <MigratePage /> },
    { name: "security", entry: "/security", path: "/security", element: <SecurityPage /> },
    {
        name: "accessibility",
        entry: "/accessibility",
        path: "/accessibility",
        element: <AccessibilityPage />,
    },
    { name: "changelog", entry: "/changelog", path: "/changelog", element: <ChangelogPage /> },
    { name: "docs", entry: "/docs", path: "/docs", element: <DocsPage /> },
    {
        name: "segment (teams)",
        entry: "/for-teams",
        path: "/for-teams",
        element: <SegmentLandingPage segment="teams" />,
    },
];

const renderPage = (page: PublicPage) =>
    render(
        <MemoryRouter initialEntries={[page.entry]}>
            <Routes>
                <Route element={page.element} path={page.path} />
            </Routes>
        </MemoryRouter>
    );

describe("public pages: skip link to <main>", () => {
    it.each(PUBLIC_PAGES)("$name: the skip link targets the page's <main>", (page) => {
        renderPage(page);
        const main = screen.getByRole("main");
        expect(main.id).toBe("lp-main");
        // Focusable from script (Enter on the link), without entering the tab order.
        expect(main.getAttribute("tabindex")).toBe("-1");
        const skip = document.querySelector('a[href="#lp-main"]');
        expect(skip).not.toBeNull();
    });

    it.each(PUBLIC_PAGES)(
        "$name: Tab reaches the skip link first, Enter moves focus into <main>",
        async (page) => {
            const user = userEvent.setup();
            renderPage(page);
            await user.tab();
            const skip = document.querySelector('a[href="#lp-main"]') as HTMLElement;
            expect(document.activeElement).toBe(skip);
            await user.keyboard("{Enter}");
            expect(document.activeElement).toBe(document.getElementById("lp-main"));
        }
    );
});

describe("public pages: motion under prefers-reduced-motion", () => {
    it("the marketing stylesheet stops every animation and transition on .lp-root", () => {
        const css = readFileSync(CSS_PATH, "utf8");
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.lp-root\s*\*[^{]*\{[^}]*animation:\s*none\s*!important[^}]*transition:\s*none\s*!important/
        );
    });
});
