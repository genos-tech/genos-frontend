/**
 * /docs and /docs/<topic> (MIP-2331): the manual pages built from `src/manual/manual.<lang>.json`.
 * The words of the manual are Ken's and are checked by the manual's own tests; this pins what the
 * pages do with them: every topic renders, the search finds a setting by its UI name, the
 * Japanese route falls back to English while there is no Japanese file, and the routes, heads and
 * sitemap list every topic.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DOCS_COPY, DOCS_GROUPS } from "../lp/copy/docs";
import DocsPage from "../lp/DocsPage";
import { hasManual, loadManual } from "../lp/manual/loadManual";
import { ManualMarkdown } from "../lp/manual/ManualMarkdown";
import { parseBlocks, parseInline, slugify } from "../lp/manual/markdown";
import { buildSearchIndex, hitPath, search } from "../lp/manual/search";
import { topicSummary } from "../lp/manual/summary";
import { groupTopics, topicOrder } from "../lp/manual/topics";
import { pageUrl } from "../lp/seo/head";
import { manualTopicHeads, manualTopicPaths } from "../lp/seo/manualHeads";
import { allPageHeads, headSpecFor } from "../lp/seo/pageHeads";
import { DOCS_META } from "../lp/seo/pageMeta";
import { routeFor } from "../lp/seo/routes";
import { buildSitemapXml } from "../lp/seo/sitemap";
import manualEn from "../manual/manual.en.json";
import type { Manual } from "../manual/manualSource";

const manual = manualEn as Manual;

// jsdom has no scrolling; the topic page scrolls to its anchor on arrival.
beforeAll(() => {
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
});

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<DocsPage />} path="/docs" />
                <Route element={<DocsPage />} path="/docs/:topic" />
            </Routes>
        </MemoryRouter>
    );

describe("markdown subset", () => {
    it("parses headings, lists, tables and inline marks", () => {
        const blocks = parseBlocks(
            [
                "Intro with **bold**, *italic* and `code`.",
                "",
                "## First",
                "",
                "- one",
                "- two",
                "",
                "1. a",
                "2. b",
                "",
                "| Setting | Who |",
                "| --- | --- |",
                "| Theme | You |",
                "",
                "## First",
            ].join("\n")
        );
        expect(blocks.map((b) => b.type)).toEqual([
            "paragraph",
            "heading",
            "ul",
            "ol",
            "table",
            "heading",
        ]);
        const ids = blocks.flatMap((b) => (b.type === "heading" ? [b.id] : []));
        expect(ids).toEqual(["first", "first-2"]);
        expect(parseInline("a **b** `c` [d](/e)").map((p) => p.type)).toEqual([
            "text",
            "bold",
            "text",
            "code",
            "text",
            "link",
        ]);
    });

    it("makes anchors for any script", () => {
        expect(slugify("Plan & Usage")).toBe("plan-usage");
        expect(slugify("設定の一覧")).toBe("設定の一覧");
    });
});

describe("every topic of the manual", () => {
    it.each(manual.topics.map((t) => [t.id, t] as const))("%s renders", (_id, topic) => {
        const { container, unmount } = render(
            <MemoryRouter>
                <ManualMarkdown markdown={topic.markdown} />
            </MemoryRouter>
        );
        expect(container.textContent?.length ?? 0).toBeGreaterThan(100);
        // Nothing of the Markdown syntax is left showing.
        expect(container.textContent).not.toMatch(/\*\*|^## |\| --- \|/m);
        for (const h of container.querySelectorAll("h2, h3")) expect(h.id).not.toBe("");
        unmount();
    });

    it("has a summary for the hub and is routed as a toggle page", () => {
        for (const topic of manual.topics) {
            expect(topicSummary(topic).length, topic.id).toBeGreaterThan(10);
            // A card must say something the title does not.
            expect(topicSummary(topic), topic.id).not.toBe(topic.title);
            expect(routeFor(`/docs/${topic.id}`)?.langs, topic.id).toBe("toggle");
        }
    });

    it("is listed in hub order, each topic once", () => {
        const order = topicOrder(manual.topics).map((t) => t.id);
        expect(new Set(order).size).toBe(order.length);
        expect(order.sort()).toEqual(manual.topics.map((t) => t.id).sort());
        // The group table names only topics that exist, so a rename cannot leave a dead entry.
        const ids = new Set(manual.topics.map((t) => t.id));
        for (const group of DOCS_GROUPS)
            for (const id of group.topics) expect(ids.has(id), id).toBe(true);
        expect(groupTopics(manual.topics).some((g) => g.id === "more")).toBe(false);
    });
});

describe("search", () => {
    const index = buildSearchIndex(manual);

    it("finds a setting by the name the app shows", () => {
        const hits = search(index, "Color theme");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].entry.kind).toBe("setting");
        expect(hits[0].entry.heading).toBe("Color theme");
        expect(hitPath(hits[0].entry)).toMatch(/^\/docs\/[a-z0-9-]+(#.+)?$/);
    });

    it("finds a topic by a word in its text, and nothing for nonsense", () => {
        expect(search(index, "revoke").some((h) => h.entry.topicId === "api-keys")).toBe(true);
        expect(search(index, "zzz-no-such-word")).toEqual([]);
        expect(search(index, "   ")).toEqual([]);
    });

    it("needs every word of the query, in any order", () => {
        expect(search(index, "key api").length).toBeGreaterThan(0);
        expect(search(index, "revoke zzz-no-such-word")).toEqual([]);
    });

    it("works on Japanese text, which has no spaces, and full-width letters", () => {
        const ja: Manual = {
            language: "ja",
            topics: [
                {
                    id: "chat",
                    title: "チャット",
                    settings: [],
                    markdown: "## メッセージ\n\nＡＰＩキーの作り方と、メッセージの送り方。",
                },
            ],
            settings: [],
        };
        const jaIndex = buildSearchIndex(ja);
        expect(search(jaIndex, "メッセージ").length).toBeGreaterThan(0);
        expect(search(jaIndex, "apiキー")[0]?.entry.topicId).toBe("chat");
    });
});

describe("the manual loader", () => {
    it("loads English, and gives Japanese visitors English until manual.ja.json exists", async () => {
        const en = await loadManual("en");
        expect(en.shown).toBe("en");
        expect(en.manual.topics.length).toBe(manual.topics.length);
        const ja = await loadManual("ja");
        expect(ja.shown).toBe(hasManual("ja") ? "ja" : "en");
    });
});

describe("DocsPage", () => {
    it("shows the hub with every topic and a search box", async () => {
        renderAt("/docs");
        expect(await screen.findByText(manual.topics[0].title)).not.toBeNull();
        for (const topic of manual.topics) {
            const link = screen.getAllByRole("link", {
                name: new RegExp(topic.title.slice(0, 20)),
            });
            expect(link.length, topic.id).toBeGreaterThan(0);
        }
        expect(screen.getByRole("searchbox")).not.toBeNull();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(DOCS_COPY.en.title);
    });

    it("searches in the page: a setting name leads to its topic, and no word ends the search", async () => {
        renderAt("/docs");
        await screen.findByText(manual.topics[0].title);
        const box = screen.getByRole("searchbox");
        fireEvent.change(box, { target: { value: "Color theme" } });
        await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/result/));
        expect(screen.getAllByText("Color theme").length).toBeGreaterThan(0);
        fireEvent.change(box, { target: { value: "zzz-no-such-word" } });
        expect(screen.getByRole("status").textContent).toBe(DOCS_COPY.en.noMatch);
        fireEvent.change(box, { target: { value: "" } });
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("renders a topic page with its headings, the topic list and previous/next", async () => {
        renderAt("/docs/shortcuts");
        const topic = manual.topics.find((t) => t.id === "shortcuts")!;
        expect(
            (await screen.findByRole("heading", { level: 1, name: topic.title })).textContent
        ).toBe(topic.title);
        expect(document.querySelectorAll("article h2").length).toBeGreaterThan(1);
        expect(document.querySelector("a[rel=prev], a[rel=next]")).not.toBeNull();
        expect(
            document.querySelector('.lp-docs-nav--side a[aria-current="page"]')?.textContent
        ).toBe(topic.title);
    });

    it("sends an unknown topic back to the hub", async () => {
        renderAt("/docs/no-such-topic");
        expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
            DOCS_COPY.en.title
        );
    });
});

describe("docs chrome copy", () => {
    it.each(["en", "ja"] as const)("%s has every label, and a group name per group", (lang) => {
        const c = DOCS_COPY[lang];
        for (const [key, value] of Object.entries(c)) {
            if (typeof value === "string") expect(value.length, key).toBeGreaterThan(0);
        }
        for (const group of DOCS_GROUPS) expect(c.groups[group.id].length).toBeGreaterThan(0);
        expect(c.other.links.map((l) => l.to)).toContain("/migrate");
    });

    it("has a title and a description in both languages", () => {
        for (const lang of ["en", "ja"] as const) {
            expect(DOCS_META[lang].title.length).toBeGreaterThan(0);
            expect(DOCS_META[lang].description.length).toBeGreaterThan(0);
        }
    });
});

describe("topic heads and sitemap", () => {
    const heads = { en: manualTopicHeads(manual) };
    const paths = manualTopicPaths(heads);

    const connecting = manual.topics.find((t) => t.id === "connecting")!;

    it("gives each topic its own title, description and canonical, in both languages", () => {
        expect(paths.length).toBe(manual.topics.length);
        for (const lang of ["en", "ja"] as const) {
            const spec = headSpecFor("/docs/connecting", lang, [], heads);
            expect(spec?.title).toBe(`${connecting.title} | Genos`);
            expect(spec?.path).toBe("/docs/connecting");
            expect(spec?.lang).toBe(lang);
        }
        expect(headSpecFor("/docs/no-such-topic", "en", [], heads)).toBeUndefined();
    });

    it("writes a served head per topic and language", () => {
        const all = allPageHeads([], heads);
        for (const path of paths) {
            expect(
                all
                    .filter((h) => h.path === path)
                    .map((h) => h.lang)
                    .sort()
            ).toEqual(["en", "ja"]);
        }
    });

    it("lists every topic in the sitemap with both language versions", () => {
        const xml = buildSitemapXml([], paths);
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        for (const path of paths) {
            expect(locs).toContain(pageUrl(path, "en"));
            expect(locs).toContain(pageUrl(path, "ja"));
        }
        expect(new Set(locs).size).toBe(locs.length);
    });
});
