/**
 * /docs (MIP-1259): the copy's own rules, checked where they are cheap to check.
 * The page's words are reviewed by a person; this pins what a test can pin: the
 * FAQ count, the shortcut ids, the anchors the page links to, and the words the
 * messaging brief forbids.
 */
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DOCS_COPY } from "../lp/copy/docs";
import DocsPage from "../lp/DocsPage";
import { DOCS_META } from "../lp/seo/pageMeta";
import { LP_ROUTES } from "../lp/seo/routes";
import { SHORTCUTS } from "../shortcuts";

const everyString = (v: unknown): string[] =>
    typeof v === "string"
        ? [v]
        : Array.isArray(v)
          ? v.flatMap(everyString)
          : v && typeof v === "object"
            ? Object.values(v).flatMap(everyString)
            : [];

describe("docs copy", () => {
    it.each(["en", "ja"] as const)("%s has 8 to 10 FAQ answers", (lang) => {
        const n = DOCS_COPY[lang].faq.items.length;
        expect(n).toBeGreaterThanOrEqual(8);
        expect(n).toBeLessThanOrEqual(10);
    });

    // MIP-2333: the shortcut list in Settings is read-only, so /docs must not say
    // the letter shortcuts can be changed there.
    it.each(["en", "ja"] as const)("%s does not claim shortcuts can be changed", (lang) => {
        expect(DOCS_COPY[lang].shortcuts).not.toHaveProperty("note");
        const text = everyString(DOCS_COPY[lang]).join("\n");
        expect(text).not.toMatch(/Settings\s*→\s*Shortcuts/);
        expect(text).not.toMatch(/設定\s*→\s*ショートカット/);
        expect(text).not.toMatch(/change the letter shortcuts/i);
        expect(text).not.toContain("で変更できます");
    });

    it("uses only shortcut ids the registry defines", () => {
        for (const lang of ["en", "ja"] as const) {
            const text = everyString(DOCS_COPY[lang]).join("\n");
            for (const m of text.matchAll(/\{key:([a-zA-Z.]+)\}/g)) {
                expect(SHORTCUTS, m[1]).toHaveProperty(m[1]);
            }
            for (const row of DOCS_COPY[lang].shortcuts.rows) {
                expect(SHORTCUTS, row.id).toHaveProperty(row.id);
            }
        }
    });

    it("links only to anchors the page has, and to routes that exist", () => {
        const anchors = [
            "start",
            "connect",
            "api-keys",
            "schedules",
            "export",
            "shortcuts",
            "faq",
        ];
        for (const lang of ["en", "ja"] as const) {
            const text = everyString(DOCS_COPY[lang]).join("\n");
            for (const m of text.matchAll(/\]\(#([a-z-]+)\)/g)) {
                expect(anchors).toContain(m[1]);
            }
            for (const m of text.matchAll(/\]\((\/[a-z-]+)\)/g)) {
                expect(LP_ROUTES.map((r) => r.path)).toContain(m[1]);
            }
        }
    });

    it("makes no claim about any AI app but Claude, and no claim the brief forbids", () => {
        const forbidden = /ChatGPT|Secretary|秘書|OpenAI|Gemini|Cursor/i;
        for (const lang of ["en", "ja"] as const) {
            for (const s of everyString(DOCS_COPY[lang])) {
                expect(s, s).not.toMatch(forbidden);
            }
        }
        for (const s of [DOCS_META.en.title, DOCS_META.en.description, DOCS_META.ja.title]) {
            expect(s).not.toMatch(forbidden);
        }
    });

    it("has a title and a description in both languages", () => {
        for (const lang of ["en", "ja"] as const) {
            expect(DOCS_META[lang].title.length).toBeGreaterThan(0);
            expect(DOCS_META[lang].description.length).toBeGreaterThan(0);
        }
    });
});

describe("DocsPage", () => {
    it("renders every guide anchor and filters with the search box", () => {
        const { container, getByRole } = render(
            <MemoryRouter initialEntries={["/docs"]}>
                <DocsPage />
            </MemoryRouter>
        );
        for (const id of [
            "start",
            "connect",
            "api-keys",
            "schedules",
            "export",
            "shortcuts",
            "faq",
        ]) {
            expect(container.querySelector(`section#${id}`), id).not.toBeNull();
        }
        const search = getByRole("searchbox");
        fireEvent.change(search, { target: { value: "zzz-no-such-word" } });
        expect(container.querySelector("section#connect")).toBeNull();
        expect(container.querySelector(".lp-docs-index")).toBeNull();
        fireEvent.change(search, { target: { value: "shortcut" } });
        expect(container.querySelector("section#shortcuts")).not.toBeNull();
        expect(container.querySelector("section#connect")).toBeNull();
    });
});

describe("docs links (MIP-1902)", () => {
    it.each(["en", "ja"] as const)("%s links /migrate from the other-guides list", (lang) => {
        expect(DOCS_COPY[lang].other.links.map((l) => l.to)).toContain("/migrate");
    });
});
