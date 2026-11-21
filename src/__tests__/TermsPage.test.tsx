/**
 * `/terms` — the interim Terms of Service (MIP-1843), behind `VITE_SHOW_TERMS_PAGE`.
 *
 * Three halves. (1) The text: the same 15 articles in Japanese and English,
 * in the same order, with the same number of clauses; no sentence that names
 * ChatGPT, OpenAI or the Secretary; no liability cap, indemnity or arbitration
 * clause (those are for counsel: see termsContent.ts); no open 【placeholder】.
 * (2) The flag: OFF means no route (the URL is the 404 page), no footer link and
 * no sitemap entry; ON means the page, the footer link and the sitemap entry.
 * (3) The page renders both languages for a visitor with no auth context.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTACT_EMAIL } from "../lp/kit/links";
import { LpShell } from "../lp/kit/LpShell";
import { buildSitemapXml } from "../lp/seo/sitemap";
import {
    TERMS_ARTICLE_IDS,
    TERMS_ARTICLES,
    TERMS_INTERIM_NOTICE,
    TERMS_INTRO_JA,
    TERMS_STATUS,
} from "../lp/termsContent";
import TermsPage from "../lp/TermsPage";
import { termsRoutes } from "../lp/termsRoute";

const JAPANESE = /[぀-ヿ一-鿿]/;

/** Every clause text, both languages, for the content guards. */
const allClauses = () =>
    TERMS_ARTICLES.flatMap((a) => [a.ja.heading, ...a.ja.items, a.en.heading, ...a.en.items]);

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("interim terms: text structure", () => {
    it("has 15 articles with ids article-1 … article-15, in order", () => {
        expect(TERMS_ARTICLE_IDS).toEqual(
            Array.from({ length: 15 }, (_, i) => `article-${i + 1}`)
        );
    });

    it("has the same clauses, in the same order and number, in Japanese and English", () => {
        for (const article of TERMS_ARTICLES) {
            expect(article.ja.items.length, `${article.id} clause count`).toBe(
                article.en.items.length
            );
            expect(article.ja.items.length, `${article.id} has clauses`).toBeGreaterThan(0);
        }
    });

    it("keeps Japanese in the ja blocks and no Japanese in the en blocks", () => {
        for (const article of TERMS_ARTICLES) {
            for (const item of article.ja.items) expect(item).toMatch(JAPANESE);
            expect(article.ja.heading).toMatch(JAPANESE);
            for (const item of article.en.items) expect(item).not.toMatch(JAPANESE);
            expect(article.en.heading).not.toMatch(JAPANESE);
        }
    });

    it("has no empty clause and no open placeholder 【…】", () => {
        for (const text of allClauses()) {
            expect(text.trim().length).toBeGreaterThan(0);
            expect(text).not.toContain("【");
            expect(text).not.toContain("】");
        }
    });

    it("never names ChatGPT, OpenAI or the Secretary (those belong to other documents)", () => {
        for (const text of allClauses()) {
            expect(text).not.toMatch(/chatgpt|openai|gpt|secretary|秘書/i);
        }
    });

    it("leaves out a liability cap, indemnity, arbitration and companies as customers", () => {
        for (const text of allClauses()) {
            expect(text).not.toMatch(/liabilit|indemn|arbitra|仲裁|損害賠償|賠償|法人のお客様/i);
        }
    });

    it("keeps the operator and the contact address the other pages show", () => {
        const body = [TERMS_INTRO_JA, ...TERMS_ARTICLES.flatMap((a) => a.ja.items)].join("\n");
        expect(body).toContain("Genos（個人事業主）");
        expect(body).toContain("特定商取引法に基づく表記");
        expect(CONTACT_EMAIL).toBe("genos.support@genosai.dev");
    });

    it("is marked interim while the flag is set to interim", () => {
        expect(TERMS_STATUS).toBe("interim");
        expect(TERMS_INTERIM_NOTICE.ja.length).toBeGreaterThan(0);
        expect(TERMS_INTERIM_NOTICE.en.length).toBeGreaterThan(0);
    });
});

describe("interim terms: the flag", () => {
    it("registers no /terms route when VITE_SHOW_TERMS_PAGE is off (the default)", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "");
        expect(termsRoutes()).toBeNull();
    });

    it('registers no /terms route for any value other than the string "true"', () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "1");
        expect(termsRoutes()).toBeNull();
    });

    it("shows no /terms link in the footer when the flag is off", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "");
        render(
            <MemoryRouter>
                <LpShell active={null}>{() => <p>body</p>}</LpShell>
            </MemoryRouter>
        );
        expect(document.querySelector('a[href="/terms"]')).toBeNull();
        // The footer keeps the one legal link it had before the flag existed.
        expect(document.querySelector('a[href="/legal"]')).not.toBeNull();
    });

    it("shows the /terms link in the footer when the flag is on", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "true");
        render(
            <MemoryRouter>
                <LpShell active={null}>{() => <p>body</p>}</LpShell>
            </MemoryRouter>
        );
        expect(document.querySelector('a[href="/terms"]')).not.toBeNull();
        expect(document.querySelector('a[href="/legal"]')).not.toBeNull();
    });

    it("omits /terms from the sitemap when the flag is off, and lists it when on", () => {
        const off = buildSitemapXml([], { includeTerms: false });
        expect(off).not.toContain("/terms");
        const on = buildSitemapXml([], { includeTerms: true });
        expect(on).toContain("https://genosai.dev/terms");
    });

    it("renders the page at /terms when the flag is on", async () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "true");
        render(
            <MemoryRouter initialEntries={["/terms"]}>
                <Routes>{termsRoutes()}</Routes>
            </MemoryRouter>
        );
        const heading = await screen.findByRole("heading", { level: 1, name: "利用規約" });
        expect(heading).toBeTruthy();
        expect(screen.getByTestId("terms-interim-notice")).toBeTruthy();
    });
});

describe("TermsPage", () => {
    it("renders all 15 articles in Japanese and English for a visitor with no auth context", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "true");
        render(
            <MemoryRouter>
                <TermsPage />
            </MemoryRouter>
        );
        const articles = screen.getAllByTestId("terms-article");
        expect(articles.length).toBe(15);
        for (const section of articles) {
            const id = section.getAttribute("data-article") ?? "";
            const ja = section.querySelector('ol[lang="ja"]');
            const en = section.querySelector('ol[lang="en"]');
            expect(ja, `${id} ja list`).not.toBeNull();
            expect(en, `${id} en list`).not.toBeNull();
            const article = TERMS_ARTICLES.find((a) => a.id === id);
            expect(ja?.querySelectorAll("li").length).toBe(article?.ja.items.length);
            expect(en?.querySelectorAll("li").length).toBe(article?.en.items.length);
        }
    });

    it("links the Privacy Policy and the Legal Notice from the bottom of the page", () => {
        render(
            <MemoryRouter>
                <TermsPage />
            </MemoryRouter>
        );
        const main = screen.getByRole("main");
        expect(
            within(main)
                .getByRole("link", { name: /プライバシーポリシー/ })
                .getAttribute("href")
        ).toBe("/privacy");
        expect(
            within(main)
                .getByRole("link", { name: /特定商取引法/ })
                .getAttribute("href")
        ).toBe("/legal");
    });
});
