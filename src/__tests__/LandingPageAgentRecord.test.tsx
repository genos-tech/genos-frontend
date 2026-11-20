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
import { shotRect } from "../lp/kit/shots";
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

/**
 * Ken's own English subhead of the record section says "AI memory" (his text, 2026-11-20); the
 * brief's rule against the phrase is waived for that one sentence and for nothing else.
 */
const KENS_AI_MEMORY_SENTENCE = "AI memory lives inside the agent.";
const withoutKensSentence = (text: string) => text.split(KENS_AI_MEMORY_SENTENCE).join("");

/** The new copy blocks, as one string per language. */
const newCopy = (lang: (typeof LANGS)[number]) => {
    const t = HOME_COPY[lang];
    return withoutKensSentence(
        JSON.stringify([t.hero, t.idea, t.how, t.record, t.works, t.questions])
    );
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
            const found = BANNED.filter(([, pattern]) =>
                pattern.test(withoutKensSentence(sections))
            ).map(([name]) => name);
            expect(found).toEqual([]);
        }
    );

    it.each(LANGS)("%s: the hero has no recording button and no chat card yet", (lang) => {
        const { container } = renderHome(lang);
        const hero = container.querySelector(".lp-hero") as HTMLElement;
        expect(hero.textContent).not.toMatch(/watch a real session|実際のセッション/i);
        // Two buttons (connect, demo), nothing else to click.
        expect(hero.querySelectorAll("a.lp-btn")).toHaveLength(2);
        expect(hero.querySelector(".lp-transcript, .lp-msg")).toBeNull();
    });

    it.each(LANGS)("%s: the hero shows the real screenshot, loaded first", (lang) => {
        const { container } = renderHome(lang);
        const img = container.querySelector(".lp-hero .lp-shot__light img") as HTMLImageElement;
        expect(img.getAttribute("src")).toBe(`/lp/shots/${lang}/record.webp`);
        expect(img.getAttribute("loading")).toBe("eager");
        expect(img.getAttribute("alt")).toBe(HOME_COPY[lang].hero.alt);
    });

    it.each(LANGS)(
        "%s: the hero has a dark picture (lazy) and a phone crop of each, picked by the window and theme",
        (lang) => {
            const { container } = renderHome(lang);
            const dark = container.querySelector(
                ".lp-hero .lp-shot__dark img"
            ) as HTMLImageElement;
            expect(dark.getAttribute("src")).toBe(`/lp/shots/${lang}/record-dark.webp`);
            expect(dark.getAttribute("loading")).toBe("lazy");
            expect(dark.getAttribute("alt")).toBe(HOME_COPY[lang].hero.alt);
            // The phone crops are <source>s under 640 px (the width lp.css stacks the labels at).
            const sources = [...container.querySelectorAll(".lp-hero picture source")].map(
                (el) => [el.getAttribute("media"), el.getAttribute("srcset")]
            );
            expect(sources).toEqual([
                ["(max-width: 640px)", expect.stringContaining(`/${lang}/record-phone.webp`)],
                ["(max-width: 640px)", expect.stringContaining(`/${lang}/record-phone-dark.webp`)],
            ]);
            expect(sources[0][1]).toContain("record-phone@2x.webp");
        }
    );

    it.each(LANGS)(
        "%s: the hero labels are real text over the picture, in the language",
        (lang) => {
            const { container } = renderHome(lang);
            const tags = [
                ...container.querySelectorAll(".lp-hero .lp-proof__tag"),
            ] as HTMLElement[];
            const copy = HOME_COPY[lang].hero.callouts;
            expect(tags.map((tag) => tag.textContent)).toEqual([copy.claude, copy.you]);
            // Not hidden from a screen reader, and placed by fractions of the picture.
            for (const tag of tags) {
                expect(tag.closest("[aria-hidden]")).toBeNull();
                expect(tag.style.getPropertyValue("--x")).not.toBe("");
                expect(tag.style.getPropertyValue("--y")).not.toBe("");
            }
            // The labels name the Claude mark and the person; the mark copy stays the app's own file.
            expect(tags[0].querySelector("img")?.getAttribute("alt")).toBe("");
        }
    );

    it.each(LANGS)("%s: the hero subhead is two paragraphs", (lang) => {
        const { container } = renderHome(lang);
        const paragraphs = container.querySelectorAll(".lp-hero__copy .lp-lead");
        expect(paragraphs).toHaveLength(2);
        expect(HOME_COPY[lang].hero.sub.split("\n\n")).toHaveLength(2);
    });

    it.each(["en", "ja"] as const)(
        "%s: the labels point inside the picture where the retake measured them",
        (lang) => {
            const { callouts } = shotRect("record", lang);
            expect(callouts).toBeDefined();
            for (const key of ["claude", "you"] as const) {
                const point = callouts![key];
                expect(point.x).toBeGreaterThan(0);
                expect(point.x).toBeLessThan(0.85); // room for the label before the time stamp
                expect(point.y).toBeGreaterThan(0);
                expect(point.y).toBeLessThan(1);
            }
            // The claude label is at a marked row above the unmarked one it is compared with.
            expect(callouts!.claude.y).toBeLessThan(callouts!.you.y);
        }
    );

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
                lang === "ja"
                    ? /会話の全文を保存するものではありません/
                    : /does not store the full text of your conversations/
            );
            expect(copy.questions.items[0].a).toMatch(
                lang === "ja"
                    ? /会話の全文を保存するわけではありません/
                    : /does not store the full text of your conversations/
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

    it("the English is marked for Ken's review and the callout wording as a draft", () => {
        // Ken's final English (2026-11-20) is a translation he re-checks: every English string of the
        // new top carries TODO(copy: Ken's final English; Ken to review). The callouts over the hero
        // picture are the page author's draft in both languages (TODO(copy)). A source read, because
        // comments are not among a module's values.
        const source = readFileSync(join(__dirname, "..", "lp", "copy", "home.ts"), "utf8");
        const english = source.match(/TODO\(copy: Ken's final English; Ken to review\)/g) ?? [];
        expect(english.length).toBeGreaterThanOrEqual(40);
        const drafts = source.match(/TODO\(copy\): draft wording/g) ?? [];
        expect(drafts).toHaveLength(2);
        expect(source).not.toMatch(/Ken decides the sentences/);
        // The four English lines softened from Ken's draft say so where they are.
        expect(source.match(/SOFTENED from Ken's draft/g) ?? []).toHaveLength(4);
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
        ]);
    });

    it.each(LANGS)(
        "%s: one FAQ: Ken's four questions, then the two earlier ones that stay true",
        (lang) => {
            const { container } = renderHome(lang);
            const asked = [...container.querySelectorAll("#questions summary")].map(
                (el) => el.textContent
            );
            expect(asked).toEqual(HOME_COPY[lang].questions.items.map((item) => item.q));
            expect(HOME_COPY[lang].questions.items).toHaveLength(6);
            // The earlier list is merged into this one, not kept beside it.
            expect(container.querySelector("#faq")).toBeNull();
            expect(container.querySelectorAll("details")).toHaveLength(6);
        }
    );

    it("the FAQ drops the earlier answers the brief rules out, and keeps the true ones", () => {
        const text = JSON.stringify(HOME_COPY.en.questions);
        // "Any MCP client" and the comparison with Slack, Notion and Jira (brief sections 5 and 6),
        // and "everything links back" (brief section 8).
        expect(text).not.toMatch(/MCP client|Slack|Notion|Jira|everything/i);
        expect(HOME_COPY.en.questions.items.map((item) => item.q).slice(4)).toEqual([
            "Who can see what Genos notes about my work?",
            "Can I try it without signing up?",
        ]);
    });
});
