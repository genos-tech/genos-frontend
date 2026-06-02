import { describe, expect, it } from "vitest";

import { filterAndRankSuggestionItems } from "../utils/suggestionRanking";

// Minimal item factory — only the fields the filter/rank reads.
const item = (title: string, aliases?: string[]) =>
    ({ title, aliases, onItemClick: () => {} }) as never;

// Mirrors the user's reported scenario: three GMs named "test", one named
// "test-v3", and a couple of unrelated notes.
const items = [
    item("test"),
    item("test"),
    item("test"),
    item("test-v3"),
    item("New My Note (1)"),
    item("New My Note (2)"),
];

const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

describe("filterAndRankSuggestionItems", () => {
    it("narrows to the exact full-word match and drops the rest", () => {
        const r = filterAndRankSuggestionItems(items, "test-v3");
        expect(titles(r)).toEqual(["test-v3"]);
    });

    it("drops items that don't contain the query at all", () => {
        const r = filterAndRankSuggestionItems(items, "note");
        expect(titles(r)).toEqual(["New My Note (1)", "New My Note (2)"]);
    });

    it("puts the exact match on top when partial matches also remain", () => {
        const r = filterAndRankSuggestionItems(items, "test");
        // The three exact "test" hits (tier 0) precede the "test-v3" prefix
        // hit (tier 1); the notes don't contain "test" so they're gone.
        expect(titles(r)).toEqual(["test", "test", "test", "test-v3"]);
    });

    it("matches aliases (e.g. a task's title behind its preview-id title)", () => {
        const withAlias = [item("PRJ-1", ["Fix login bug"]), item("PRJ-2", ["Other"])];
        const r = filterAndRankSuggestionItems(withAlias, "login");
        expect(titles(r)).toEqual(["PRJ-1"]);
    });

    it("is a no-op for an empty query (keeps caller ordering)", () => {
        const r = filterAndRankSuggestionItems(items, "");
        expect(titles(r)).toEqual(titles(items));
    });
});
