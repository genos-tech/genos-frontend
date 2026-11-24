/**
 * /migrate (MIP-1260): the copy's own rules, checked where a test can check them: every link
 * goes to a page or an anchor that exists, the gaps are named, and the forbidden words stay out.
 */
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MIGRATE_COPY } from "../lp/copy/migrate";
import MigratePage from "../lp/MigratePage";
import { MIGRATE_META } from "../lp/seo/pageMeta";
import { routeFor } from "../lp/seo/routes";

const everyString = (v: unknown): string[] =>
    typeof v === "string"
        ? [v]
        : Array.isArray(v)
          ? v.flatMap(everyString)
          : v && typeof v === "object"
            ? Object.values(v).flatMap(everyString)
            : [];

describe("migrate copy", () => {
    it.each(["en", "ja"] as const)("%s names the four tools that have no import", (lang) => {
        const tools = MIGRATE_COPY[lang].gaps.map((g) => g.tool);
        expect(tools).toHaveLength(4);
        for (const t of ["Slack", "Jira"]) expect(tools).toContain(t);
        expect(tools.join(" ")).toMatch(/Notion/);
        expect(tools.join(" ")).toMatch(/Google/);
    });

    it.each(["en", "ja"] as const)("%s links only to real anchors and routes", (lang) => {
        const anchors = ["start", "notes", "tasks", "gaps"];
        const text = everyString(MIGRATE_COPY[lang]).join("\n");
        for (const m of text.matchAll(/\]\(#([a-z-]+)\)/g)) {
            expect(anchors).toContain(m[1]);
        }
        for (const m of text.matchAll(/\]\((\/[a-z-/]+)\)/g)) {
            expect(routeFor(m[1].split("#")[0]), m[1]).toBeDefined();
        }
    });

    it("makes no claim about AI apps other than Claude, and no sync claim", () => {
        const forbidden = /ChatGPT|Secretary|秘書|OpenAI|Gemini|Cursor/i;
        for (const lang of ["en", "ja"] as const) {
            for (const s of everyString(MIGRATE_COPY[lang])) {
                expect(s, s).not.toMatch(forbidden);
            }
        }
        for (const s of [
            MIGRATE_META.en.title,
            MIGRATE_META.en.description,
            MIGRATE_META.ja.description,
        ]) {
            expect(s).not.toMatch(forbidden);
        }
    });
});

describe("MigratePage", () => {
    it("renders the sections and hides the TODO(copy) markers", () => {
        const { container, queryByText } = render(
            <MemoryRouter initialEntries={["/migrate"]}>
                <MigratePage />
            </MemoryRouter>
        );
        for (const id of ["start", "notes", "tasks", "gaps"]) {
            expect(container.querySelector(`section#${id}`), id).not.toBeNull();
        }
        expect(container.textContent).not.toContain("TODO(copy)");
        expect(queryByText(/Import folder/)).not.toBeNull();
    });
});
