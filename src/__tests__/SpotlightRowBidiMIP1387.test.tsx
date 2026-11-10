/**
 * MIP-1387: in `ar` a Latin Spotlight row title was clipped at its START ("...st comment hit"):
 * the row is RTL, the title truncates with `text-overflow: ellipsis`, and the line ends on the
 * left, so an LTR run loses its first letters. The title is an island (`<bdi className=
 * "g-bidi-island">`, App.css, the MIP-1180 pattern) that truncates itself at its own end.
 * `HighlightedText` is shared with the Ask answer's source chips, so those carry the island
 * too. jsdom has no bidi algorithm: the rendered markup is pinned here and the pixels were
 * checked in Chromium in `ar` at 1440 and 390 (see the PR).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpotlightResultItem } from "../features/spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../features/spotlight/types";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8").replace(/\s+/g, " ");

const result: SpotlightResult = {
    entity_type: "task",
    entity_id: "task:2",
    title: "Test comment hit",
    snippet: null,
    score: 1,
    keyword_rank: 1,
    vector_rank: null,
    matched_chunk_types: ["task_comment"],
    matched_terms: ["test"],
    updated_at: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: "2",
    task_display_id: "APL-2",
    note_id: null,
    note_type: null,
    project_id: null,
    related_entity_ids: [],
};

describe("a Spotlight row title is a bidi island", () => {
    it("renders the highlighted title inside bdi.g-bidi-island", () => {
        const { container } = render(
            <CssVarsProvider>
                <SpotlightResultItem query="test" result={result} onSelect={() => {}} />
            </CssVarsProvider>
        );
        const islands = container.querySelectorAll("bdi.g-bidi-island");
        expect(islands).toHaveLength(1);
        // The whole title, matched word included, sits in it.
        expect(islands[0].textContent).toBe("Test comment hit");
        expect(islands[0].querySelector("span")?.textContent).toBe("Test");
    });

    it("the island rule truncates at its own end in RTL, and is plain inline text in LTR", () => {
        const css = readFileSync(resolve(srcDir, "App.css"), "utf8");
        expect(css).toMatch(
            /\[dir="rtl"\] \.g-bidi-island \{[^}]*display: inline-block;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/
        );
        expect(css).not.toMatch(/(^|\n)\.g-bidi-island \{/);
    });

    it("the Ask answer's source chips carry the island too (HighlightedText is shared)", () => {
        expect(source("features/agentQA/AgentTurnSources.tsx")).toMatch(
            /<bdi className="g-bidi-island"> <HighlightedText[^>]*extraTerms=\{s\.matched_terms\}[^>]*query=\{query\}[^>]*text=\{sourceChipLabel\(s, labels, noteScopes\)\}[^>]*\/> <\/bdi>/
        );
    });
});
