/**
 * MIP-1243: a citation marker that cannot become a chip must vanish WITHOUT
 * leaving its brackets behind. Spotlight answers ended `... Web Animations API
 * [,].` and, in Japanese, `タスクA（）は完了`: the model cited several tasks in one
 * bracket (`[task:1, task:2]`) or put a raw id in parentheses, and the stripper
 * removed each id but not the punctuation around it.
 */
import { describe, expect, it } from "vitest";

import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    citedChipSources,
    extractBareCitedIds,
    rewriteCitations,
} from "../features/agentQA/citationUtils";
import type { SpotlightResult } from "../features/spotlight/types";

const src = (entity_type: string, entity_id: string, title = ""): SpotlightResult =>
    ({ entity_type, entity_id, title }) as unknown as SpotlightResult;

const noSources = new Map<string, SpotlightResult>();

describe("rewriteCitations leaves no empty brackets behind", () => {
    it.each<[string, string, string]>([
        // a group of tokens in one bracket
        [
            "group, comma+space",
            "Uses the Web Animations API [task:12, task:13].",
            "Uses the Web Animations API.",
        ],
        [
            "group, comma only",
            "Uses the Web Animations API [task:12,task:13].",
            "Uses the Web Animations API.",
        ],
        [
            "group, semicolon",
            "Uses the Web Animations API [task:12; note:personal:4].",
            "Uses the Web Animations API.",
        ],
        [
            "group, padded",
            "Uses the Web Animations API [ task:12 , task:13 ].",
            "Uses the Web Animations API.",
        ],
        ["group, ideographic comma", "決定した[task:12、task:13]。", "決定した。"],
        [
            "group of three, mixed kinds",
            "Done [task:12, project:3, chat:dm:5:thread:4] ok",
            "Done ok",
        ],
        [
            "group of ids pass 3 would not catch (no digit)",
            "Uses the API [task:abc, note:xyz].",
            "Uses the API.",
        ],
        // raw ids in parentheses (ASCII and full width)
        ["raw id in parentheses", "Hero handoff (task:12) shipped.", "Hero handoff shipped."],
        [
            "raw ids in a parenthesised list",
            "Hero handoff (task:12, task:13) shipped.",
            "Hero handoff shipped.",
        ],
        ["raw id in full-width parentheses", "タスクA（task:12）は完了。", "タスクAは完了。"],
        ["raw ids in full-width list", "タスクA（task:12、task:13）は完了。", "タスクAは完了。"],
        ["raw id in full-width brackets", "タスクA［task:12］は完了。", "タスクAは完了。"],
        ["raw id after a space, ASCII", "タスクA (task:12) は完了。", "タスクA は完了。"],
        [
            "dropped unresolved raw-label link in parentheses",
            "Done ([task:42](task:42)).",
            "Done.",
        ],
        // a marker that stands alone still just goes
        ["single bare token", "Per the spike [task:42].", "Per the spike."],
    ])("%s", (_name, input, expected) => {
        expect(rewriteCitations(input, noSources)).toBe(expected);
    });

    it.each<[string, string]>([
        ["a call in prose", "Call f(x) then g() twice."],
        ["a numbered reference", "As shown in [1] and [2]."],
        ["a task-list checkbox", "- [ ] write the doc\n- [x] ship it"],
        [
            "literal empty brackets, no marker involved",
            "An empty array is [] and an empty call is ().",
        ],
        ["code spans", "Use `foo()` or `[]` or `bar(baz)`."],
        ["a fenced block", "```js\nconst a = [];\nrun();\n```"],
        ["real parentheses with words", "Web Animations (the browser API) is enough."],
        ["a real link", "See [the docs](https://example.com/a_b) for (more)."],
        ["free-form bracketed prose", "[reminder: ship by Friday] and (note: later)"],
    ])("does not touch %s", (_name, input) => {
        expect(rewriteCitations(input, noSources)).toBe(input);
    });

    it("keeps real brackets next to a stripped marker", () => {
        expect(rewriteCitations("Call f(x) [task:12] and read [1].", noSources)).toBe(
            "Call f(x) and read [1]."
        );
        expect(rewriteCitations("Use f() (see task:12) now.", noSources)).toBe(
            "Use f() (see) now."
        );
    });

    it("keeps a resolved link while cleaning the debris after it", () => {
        const sources = buildSourcesById([src("task", "task:12", "Spike")]);
        expect(rewriteCitations("The [spike](task:12) (task:13).", sources)).toBe(
            `The [spike](${CITATION_HREF_PREFIX}task:12).`
        );
    });

    it("never lets the private marker reach the renderer", () => {
        const out = rewriteCitations(
            "a [task:1, task:2] b (task:3) c ([x](task:4)) d ",
            noSources
        );
        expect(out).not.toContain("");
    });
});

describe("a group or a raw id that names a retrieved source becomes a chip", () => {
    const sources = [
        src("task", "task:12", "A"),
        src("task", "task:13", "B"),
        src("task", "task:14", "C"),
    ];

    it("every resolvable member of a group chips; an unresolvable one drops out", () => {
        const answer = "Both ruled it out [task:12, task:99].";
        expect(extractBareCitedIds(answer)).toEqual(new Set(["task:12", "task:99"]));
        expect(citedChipSources(answer, sources).map((s) => s.entity_id)).toEqual(["task:12"]);
    });

    it("a full-width raw id chips too", () => {
        const answer = "タスクA（task:13）は完了。";
        expect(citedChipSources(answer, sources).map((s) => s.entity_id)).toEqual(["task:13"]);
    });

    it("a raw id inside a resolved link's URL is not read a second time", () => {
        const answer = "The [spike](task:12) went well.";
        expect(citedChipSources(answer, sources).map((s) => s.entity_id)).toEqual(["task:12"]);
    });

    it("an answer that cites nothing still has an empty chip row", () => {
        expect(citedChipSources("Nothing cited (see above).", sources)).toEqual([]);
    });
});
