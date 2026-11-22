/**
 * `/terms` — the interim Terms of Service (MIP-1843),, always routed (no build flag).
 *
 * Three halves. (1) The text: the same 15 articles in Japanese and English,
 * in the same order, with the same number of clauses; no sentence that names
 * ChatGPT, OpenAI or the Secretary; no liability cap, indemnity or arbitration
 * clause (those are for counsel: see termsContent.ts); no open 【placeholder】.
 * (2) The route, the footer link and the sitemap entry exist with no env set.
 * (3) The page renders both languages for a visitor with no auth context.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("interim terms: always on, no build flag (MIP-1903)", () => {
    it("always links /terms from the footer, with the legal notice beside it", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "");
        render(
            <MemoryRouter>
                <LpShell active={null}>{() => <p>body</p>}</LpShell>
            </MemoryRouter>
        );
        expect(document.querySelector('a[href="/terms"]')).not.toBeNull();
        expect(document.querySelector('a[href="/legal"]')).not.toBeNull();
    });

    it("lists /terms in the sitemap", () => {
        expect(buildSitemapXml([])).toContain("https://genosai.dev/terms");
    });

    it("mounts the /terms route in main.tsx with no env set", () => {
        vi.stubEnv("VITE_SHOW_TERMS_PAGE", "");
        const main = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");
        expect(main).toMatch(/path="\/terms"/);
        expect(main).not.toContain("VITE_SHOW_TERMS_PAGE");
    });
});

describe("TermsPage", () => {
    it("renders all 15 articles in Japanese and English for a visitor with no auth context", () => {
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
