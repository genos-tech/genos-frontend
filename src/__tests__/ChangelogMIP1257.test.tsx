/**
 * `/changelog` (MIP-1257): ten dated entries, newest first, each tied to merged
 * PRs; a roadmap with only `Live` and `Coming` labels and no dates; the RSS
 * feed built from the same entries; no banned word; nothing internal rendered.
 */
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CHANGELOG_ENTRIES } from "../lp/changelog/changelog";
import { buildChangelogRss } from "../lp/changelog/rss";
import { CHANGELOG_COPY } from "../lp/copy/changelog";
import { buildHeadTags, pageUrl } from "../lp/seo/head";
import { CHANGELOG_META } from "../lp/seo/pageMeta";
import { LP_ROUTES, routeFor } from "../lp/seo/routes";

/** What a reader can see: the entries without the internal `todo` note, and the copy. */
const allText = () =>
    JSON.stringify({
        entries: CHANGELOG_ENTRIES.map(({ todo: _todo, ...visible }) => visible),
        copy: CHANGELOG_COPY,
    });

describe("changelog entries", () => {
    it("has exactly ten entries, newest first, with unique ids", () => {
        expect(CHANGELOG_ENTRIES).toHaveLength(10);
        const dates = CHANGELOG_ENTRIES.map((e) => e.date);
        expect([...dates].sort().reverse()).toEqual(dates);
        expect(new Set(CHANGELOG_ENTRIES.map((e) => e.id)).size).toBe(10);
        for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("has a title and body in both languages, and names the merged PRs it is tied to", () => {
        for (const e of CHANGELOG_ENTRIES) {
            for (const lang of ["en", "ja"] as const) {
                expect(e[lang].title.trim().length, e.id).toBeGreaterThan(0);
                expect(e[lang].body.trim().length, e.id).toBeGreaterThan(0);
            }
            expect(e.prs.length, e.id).toBeGreaterThan(0);
            for (const pr of e.prs) expect(pr, e.id).toMatch(/^genos-(frontend|api|docs)#\d+$/);
        }
    });

    it("never uses the banned product word, and renders no internal note", () => {
        const text = allText();
        expect(text).not.toMatch(/secretary/i);
        expect(text).not.toContain("秘書");
        expect(text).not.toMatch(/MIP-\d/);
    });
});

describe("roadmap", () => {
    it("labels each item live or coming, and never with a date", () => {
        for (const item of CHANGELOG_COPY.en.roadmap.concat(CHANGELOG_COPY.ja.roadmap)) {
            expect(["live", "coming"]).toContain(item.status);
            expect(item.text).not.toMatch(
                /\d{4}|\d{1,2}\s?(月|日)|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/
            );
        }
    });

    it("lists ChatGPT only as coming, because the existing pages say so", () => {
        for (const lang of ["en", "ja"] as const) {
            const chatgpt = CHANGELOG_COPY[lang].roadmap.filter((i) => /ChatGPT/.test(i.text));
            expect(chatgpt.length).toBe(1);
            expect(chatgpt[0].status).toBe("coming");
        }
    });
});

describe("RSS feed", () => {
    const xml = buildChangelogRss(CHANGELOG_ENTRIES);
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    it("is well-formed and carries one item per entry, in the same order", () => {
        expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
        const items = [...doc.getElementsByTagName("item")];
        expect(items).toHaveLength(10);
        expect(items.map((i) => i.getElementsByTagName("title")[0].textContent)).toEqual(
            CHANGELOG_ENTRIES.map((e) => e.en.title)
        );
    });

    it("dates each item by the entry's merge date, in RFC 822 form", () => {
        const items = [...doc.getElementsByTagName("item")];
        items.forEach((item, i) => {
            const pub = item.getElementsByTagName("pubDate")[0].textContent ?? "";
            expect(new Date(pub).toISOString().slice(0, 10)).toBe(CHANGELOG_ENTRIES[i].date);
        });
    });

    it("escapes markup in the text", () => {
        const sample = buildChangelogRss([
            {
                id: "x",
                date: "2026-01-01",
                prs: ["genos-api#1"],
                en: { title: "a < b & c", body: "<b>x</b>" },
                ja: { title: "x", body: "x" },
            },
        ]);
        expect(
            new DOMParser()
                .parseFromString(sample, "application/xml")
                .getElementsByTagName("parsererror")
        ).toHaveLength(0);
    });
});

describe("route and meta", () => {
    it("is a bilingual toggle page", () => {
        expect(routeFor("/changelog")?.langs).toBe("toggle");
        expect(LP_ROUTES.map((r) => r.path)).toContain("/changelog");
    });

    it("has meta in both languages and an alternate pair", () => {
        for (const lang of ["en", "ja"] as const) {
            expect(CHANGELOG_META[lang].title.length).toBeGreaterThan(0);
            expect(CHANGELOG_META[lang].description.length).toBeGreaterThan(20);
            const tags = buildHeadTags({
                ...CHANGELOG_META[lang],
                ogTitle: CHANGELOG_META[lang].title,
                ogDescription: CHANGELOG_META[lang].description,
                path: "/changelog",
                lang,
            });
            const canonical = tags.find((t) => t.kind === "link" && t.rel === "canonical");
            expect(canonical && canonical.kind === "link" && canonical.href).toBe(
                pageUrl("/changelog", lang)
            );
        }
    });
});

describe("changelog page render", () => {
    it("renders the roadmap labels and all ten entries", async () => {
        const { default: ChangelogPage } = await import("../lp/ChangelogPage");
        const { container } = render(
            <MemoryRouter>
                <ChangelogPage />
            </MemoryRouter>
        );
        const updates = container.querySelector("#updates") as HTMLElement;
        expect(updates).not.toBeNull();
        expect(within(updates).getAllByRole("heading", { level: 3 })).toHaveLength(10);
        expect(container.querySelectorAll("#roadmap .lp-badge")).toHaveLength(
            CHANGELOG_COPY.en.roadmap.length
        );
        expect(container.textContent).not.toContain("TODO");
        expect(container.querySelector('a[href="/changelog.rss"]')).not.toBeNull();
    });
});
