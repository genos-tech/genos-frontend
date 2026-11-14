/**
 * `/terms` — the Terms of Service page, behind `VITE_SHOW_TERMS_PAGE`.
 *
 * Two halves. (1) The flag: OFF (the default) means no route (the URL is the
 * 404 page) and no link anywhere, so an accidental merge publishes nothing;
 * ON means the page and one footer link. (2) The content module: structural
 * guards that hold for the draft AND for counsel's text once it is swapped in.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrivacyPage from "../lp/PrivacyPage";
import {
    COURT_EN,
    COURT_JA,
    ENACTED_ON,
    OPERATOR_EN,
    OPERATOR_JA,
    TERMS_ARTICLES,
    TERMS_INTRO_JA,
    TERMS_STATUS,
    TERMS_SUMMARY_EN,
} from "../lp/termsContent";
import { isTermsPageEnabled } from "../lp/termsFlag";
import { termsRoutes } from "../lp/termsRoute";

afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
});

const NOT_FOUND = "stub-404";

/** The public routes as main.tsx mounts them: /terms (when on) before the catch-all. */
const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {termsRoutes()}
                <Route element={<p>{NOT_FOUND}</p>} path="*" />
                <Route element={<PrivacyPage />} path="/privacy" />
            </Routes>
        </MemoryRouter>
    );

const footer = () => screen.getByRole("contentinfo");

describe("VITE_SHOW_TERMS_PAGE off (the default)", () => {
    it("is off when unset and for anything but the string true", () => {
        expect(isTermsPageEnabled()).toBe(false);
        for (const value of ["", "false", "1", "TRUE", "yes"]) {
            vi.stubEnv("VITE_SHOW_TERMS_PAGE", value);
            expect(isTermsPageEnabled()).toBe(false);
        }
    });

    it("registers no route: /terms falls through to the not-found page", () => {
        expect(termsRoutes()).toBeNull();
        renderAt("/terms");
        expect(screen.getByText(NOT_FOUND)).toBeTruthy();
        expect(screen.queryByText("利用規約")).toBeNull();
    });

    it("shows no link to /terms anywhere and leaves the footer as it was", () => {
        const { container } = renderAt("/privacy");
        expect(container.querySelector('a[href="/terms"]')).toBeNull();
        // The old combined label stays while there is no real Terms page.
        expect(within(footer()).getByRole("link", { name: "Terms and legal" })).toBeTruthy();
        expect(within(footer()).queryByRole("link", { name: "Terms of Service" })).toBeNull();
    });
});

describe("VITE_SHOW_TERMS_PAGE=true", () => {
    const on = () => vi.stubEnv("VITE_SHOW_TERMS_PAGE", "true");

    it("serves the page at /terms with every article, an anchor each, and both languages", async () => {
        on();
        const { container } = renderAt("/terms");
        expect(await screen.findByRole("heading", { level: 1, name: "利用規約" })).toBeTruthy();
        expect(
            screen.getByRole("heading", { name: "Terms of Service (English summary)" })
        ).toBeTruthy();
        // Every article is a heading with its own id, and the contents list points at each.
        for (const article of TERMS_ARTICLES) {
            const heading = container.querySelector(`h2#${article.id}`);
            expect(heading?.textContent, article.id).toBe(article.heading);
            expect(
                container.querySelector(`nav a[href="#${article.id}"]`),
                article.id
            ).toBeTruthy();
        }
        expect(container.querySelector('nav a[href="#terms-en"]')).toBeTruthy();
        expect(container.querySelector("#terms-en")).toBeTruthy();
        // The two operative claims counsel asked about are really on the page.
        expect(screen.getByText(/損害発生前12か月間/)).toBeTruthy();
        expect(screen.getByText(/民法第548条の4/)).toBeTruthy();
        expect(container.textContent).toContain("Japanese law governs");
    });

    it("says it is a draft while TERMS_STATUS is draft", async () => {
        on();
        renderAt("/terms");
        await screen.findByRole("heading", { level: 1, name: "利用規約" });
        expect(Boolean(screen.queryByTestId("terms-draft-notice"))).toBe(TERMS_STATUS === "draft");
    });

    it("adds one footer link to /terms and relabels /legal so the two do not both say terms", async () => {
        on();
        renderAt("/terms");
        await screen.findByRole("heading", { level: 1, name: "利用規約" });
        expect(
            within(footer()).getByRole("link", { name: "Terms of Service" }).getAttribute("href")
        ).toBe("/terms");
        expect(
            within(footer()).getByRole("link", { name: "Legal notice" }).getAttribute("href")
        ).toBe("/legal");
        expect(within(footer()).queryByRole("link", { name: "Terms and legal" })).toBeNull();
    });

    it("the ja/en toggle switches the shell, as on /privacy, and leaves the legal body alone", async () => {
        on();
        const user = userEvent.setup();
        const { container } = renderAt("/terms");
        await screen.findByRole("heading", { level: 1, name: "利用規約" });
        const before = container.querySelector("#article-1")?.textContent;

        await user.click(screen.getByRole("button", { name: "日本語" }));
        expect(screen.getByRole("button", { name: "日本語" }).getAttribute("aria-pressed")).toBe(
            "true"
        );
        expect(within(footer()).getByRole("link", { name: "利用規約" }).getAttribute("href")).toBe(
            "/terms"
        );
        expect(
            within(footer()).getByRole("link", { name: "特定商取引法に基づく表記" })
        ).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "EN" }));
        expect(screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed")).toBe(
            "true"
        );
        expect(within(footer()).getByRole("link", { name: "Terms of Service" })).toBeTruthy();
        // The operative text does not move with the toggle.
        expect(container.querySelector("#article-1")?.textContent).toBe(before);
        expect(screen.getByRole("heading", { level: 1, name: "利用規約" })).toBeTruthy();
    });
});

describe("termsContent.ts", () => {
    it("has unique anchors, and every article has text", () => {
        const ids = TERMS_ARTICLES.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const article of TERMS_ARTICLES) {
            expect(article.id).toMatch(/^article-\d+(-\d+)?$/);
            expect(article.heading).toMatch(/^第\d+条(の\d+)?（.+）$/);
            expect(article.lead || article.clauses?.length, article.id).toBeTruthy();
        }
        expect(TERMS_ARTICLES.length).toBe(17);
    });

    it("carries no reviewer notes or markers meant for counsel", () => {
        const all = JSON.stringify([TERMS_INTRO_JA, TERMS_ARTICLES, TERMS_SUMMARY_EN]);
        expect(all).not.toMatch(/弁護士確認|Proposed|for counsel|TODO|FIXME|TBD/);
    });

    it("keeps the placeholders to the three named constants, and only while a draft", () => {
        const all = JSON.stringify([TERMS_INTRO_JA, TERMS_ARTICLES, TERMS_SUMMARY_EN]);
        const found = new Set(all.match(/【[^】]*】/g));
        const named = [OPERATOR_JA, OPERATOR_EN, COURT_JA, COURT_EN];
        for (const placeholder of found) expect(named).toContain(placeholder);
        if (TERMS_STATUS === "approved") {
            // The publish gate: counsel's text must have replaced every placeholder.
            expect(found.size).toBe(0);
            expect(ENACTED_ON).not.toMatch(/【/);
        }
    });
});

describe("/terms route registration", () => {
    const main = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");

    it("is mounted among the public pages, before the auth layout, via termsRoutes()", () => {
        const call = main.indexOf("{termsRoutes()}");
        expect(call).toBeGreaterThan(0);
        expect(call).toBeLessThan(main.indexOf("<AuthLayout />"));
        // No unconditional route: the only /terms route is inside the flag guard.
        expect(main).not.toContain('path="/terms"');
    });

    it("keeps the flag comparison and the lazy import in the same branch (so off drops the chunk)", () => {
        const source = readFileSync(resolve(__dirname, "../lp/termsRoute.tsx"), "utf8");
        const guard = source.indexOf('import.meta.env.VITE_SHOW_TERMS_PAGE !== "true"');
        const lazyImport = source.indexOf('import("./TermsPage")');
        expect(guard).toBeGreaterThan(0);
        expect(lazyImport).toBeGreaterThan(guard);
        // And nothing else imports the page statically.
        expect(source).not.toMatch(/^import .* from "\.\/TermsPage"/m);
    });
});
