/**
 * The agent-record top of /home (MIP-1611): what the messaging brief v1 (Genos board, task note
 * 176) says the new sections may and may not say, and what must stay on the page.
 *
 * Layout is not testable here (jsdom measures nothing); the page is checked by eye at 1440, 768
 * and 390 px, light and dark, in both languages. These pin the rules a later edit could break
 * silently: a banned word creeping back into the hero or a new section, a recording button
 * before a recording exists, the works-with row dropping "coming", and the earlier sections
 * (reordered, not deleted) going missing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_COPY } from "../lp/copy/home";
import LandingPage from "../lp/LandingPage";

const LANGS = ["en", "ja"] as const;

const setLanguage = (value: string) =>
    vi.spyOn(navigator, "language", "get").mockReturnValue(value);

beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/home");
});
afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

const renderHome = (lang: (typeof LANGS)[number]) => {
    setLanguage(lang === "ja" ? "ja-JP" : "en-US");
    return render(
        <MemoryRouter>
            <LandingPage />
        </MemoryRouter>
    );
};

/** What the new sections must not say (brief sections 8, 9 and 10), in both languages. */
const BANNED: Array<[string, RegExp]> = [
    ["Secretary", /secretary|秘書/i],
    ["MCP-native", /MCP[- ]?native|MCPネイティブ/i],
    ["AI memory", /AI memory|AIメモリ|AIのメモリ/i],
    ["always", /\balways\b|常に|いつも(?!どおり)/i],
    ["everything", /\beverything\b|すべて|全て/i],
    ["automatic", /automatic|自動/i],
    ["the free first month", /first month|free month|最初の1か月|初月|1か月無料/i],
    ["a data-safety claim", /data safety|data-safety|データの安全|データ安全/i],
    ["team sharing", /team sharing|チーム共有|チームで共有/i],
    ["one place", /\bone place\b|ひとつの場所|1つの場所/i],
];

/** The new copy blocks, as one string per language. */
const newCopy = (lang: (typeof LANGS)[number]) => {
    const t = HOME_COPY[lang];
    return JSON.stringify([t.hero, t.idea, t.how, t.record, t.works, t.questions]);
};

describe("the agent-record top of /home", () => {
    it.each(LANGS)("%s: the new copy says nothing the brief rules out", (lang) => {
        const text = newCopy(lang);
        const found = BANNED.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
        expect(found).toEqual([]);
    });

    it.each(LANGS)(
        "%s: the rendered hero and new sections say nothing the brief rules out",
        (lang) => {
            const { container } = renderHome(lang);
            const sections = ["#idea", "#how", "#record", "#works", "#questions"]
                .map((selector) => container.querySelector(selector)?.textContent ?? "")
                .concat(container.querySelector(".lp-hero")?.textContent ?? "")
                .join(" ");
            expect(sections.length).toBeGreaterThan(500);
            const found = BANNED.filter(([, pattern]) => pattern.test(sections)).map(
                ([name]) => name
            );
            expect(found).toEqual([]);
        }
    );

    it.each(LANGS)("%s: the hero has no recording button and no chat card yet", (lang) => {
        const { container } = renderHome(lang);
        const hero = container.querySelector(".lp-hero") as HTMLElement;
        expect(hero.textContent).not.toMatch(/watch a real session|実際のセッション/i);
        // One image (the product screenshot), two buttons (connect, demo), nothing else.
        expect(hero.querySelectorAll("img")).toHaveLength(1);
        expect(hero.querySelectorAll("a.lp-btn")).toHaveLength(2);
        expect(hero.querySelector(".lp-transcript, .lp-msg")).toBeNull();
    });

    it.each(LANGS)("%s: the hero shows the real screenshot, loaded first", (lang) => {
        const { container } = renderHome(lang);
        const img = container.querySelector(".lp-hero img") as HTMLImageElement;
        expect(img.getAttribute("src")).toBe(`/lp/shots/${lang}/record.webp`);
        expect(img.getAttribute("loading")).toBe("eager");
        expect(img.getAttribute("alt")).toBe(HOME_COPY[lang].hero.alt);
    });

    it.each(LANGS)("%s: Connect Claude opens the steps, and the demo button stays", (lang) => {
        renderHome(lang);
        const copy = HOME_COPY[lang];
        const connect = screen.getByRole("link", { name: copy.hero.primary });
        expect(connect.getAttribute("href")).toBe("/developers#connect-an-ai-app");
        const demo = screen
            .getAllByRole("link", { name: copy.hero.secondary })
            .map((a) => a.getAttribute("href"));
        expect(demo.length).toBeGreaterThan(0);
    });

    it.each(LANGS)(
        "%s: says plainly what works today, what is coming and what is kept",
        (lang) => {
            const copy = HOME_COPY[lang];
            expect(copy.works.agents.map((a) => [a.name, Boolean(a.coming)])).toEqual([
                ["Claude", false],
                ["ChatGPT", true],
            ]);
            // The kept line names what is kept and what is not; the FAQ says it again.
            expect(copy.works.kept).toMatch(
                lang === "ja" ? /会話の全文ではありません/ : /not the whole conversation/
            );
            expect(copy.questions.items[0].a).toMatch(
                lang === "ja" ? /会話の全文は残しません/ : /does not keep the whole conversation/
            );
            // Connecting needs Core (connectApp.plan): the steps and the FAQ both say so.
            expect(copy.how.plan).toMatch(/Core/);
            expect(copy.questions.items.some((item) => /Core/.test(item.a))).toBe(true);
        }
    );

    it.each(LANGS)("%s: three tiles and three steps, in the order of the story", (lang) => {
        const copy = HOME_COPY[lang];
        expect(copy.idea.tiles.map((tile) => tile.key)).toEqual(["more", "lose", "keep"]);
        expect(copy.how.steps).toHaveLength(3);
        const { container } = renderHome(lang);
        expect(container.querySelectorAll("#idea .lp-tile")).toHaveLength(3);
        expect(container.querySelectorAll("#how .lp-how__step")).toHaveLength(3);
    });

    it("every headline and subhead sentence of the new top is marked as a placeholder", () => {
        // The sentences are Ken's to choose (brief section 11). Each one in copy/home.ts carries a
        // TODO(copy: Ken decides the sentences); losing the markers would make a draft look final.
        // A source read, because comments are not among a module's values. Nine per language:
        // meta title and description, hero title, subhead and legend, idea kicker, how title,
        // record title and subhead.
        const source = readFileSync(join(__dirname, "..", "lp", "copy", "home.ts"), "utf8");
        const markers = source.match(/TODO\(copy: Ken decides the sentences\)/g) ?? [];
        expect(markers.length).toBeGreaterThanOrEqual(18);
    });

    it("the new top comes first, and every earlier section is still on the page, in its old order", () => {
        const { container } = renderHome("en");
        const ids = [...container.querySelectorAll("main section[id]")].map((el) => el.id);
        expect(ids).toEqual([
            "idea",
            "how",
            "record",
            "works",
            "questions",
            // From here down: the earlier page, reordered and not rewritten.
            "decision",
            "workspace",
            "ask",
            "mcp",
            "secretary",
            "for",
            "trust",
            "faq",
        ]);
    });

    it("the earlier FAQ keeps all of its questions", () => {
        const { container } = renderHome("en");
        const asked = [...container.querySelectorAll("#faq summary")].map((el) => el.textContent);
        expect(asked).toEqual(HOME_COPY.en.faq.items.map((item) => item.q));
        expect(HOME_COPY.en.faq.items).toHaveLength(5);
    });
});
