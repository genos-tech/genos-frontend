import { describe, expect, it } from "vitest";

import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    extractInlineCitedIds,
    rewriteCitations,
    sourcesNotInline,
} from "../features/agentQA/citationUtils";
import type { SpotlightResult } from "../features/spotlight/types";

// Minimal SpotlightResult — buildSourcesById only reads entity_type /
// entity_id, and the render path only needs the id to be present in the
// map (the resolve-guard is a `.has()` check).
const src = (entity_type: string, entity_id: string, title = ""): SpotlightResult =>
    ({ entity_type, entity_id, title }) as unknown as SpotlightResult;

const noSources = new Map<string, SpotlightResult>();

describe("rewriteCitations — bare token fallback (stripped → chips)", () => {
    it("strips the original chat/task/note/project tokens", () => {
        expect(rewriteCitations("Per the spike [task:42].", noSources)).toBe("Per the spike.");
        expect(rewriteCitations("See the note [note:personal:50].", noSources)).toBe(
            "See the note."
        );
        expect(rewriteCitations("Bob said [chat:dm:9:thread:4] earlier.", noSources)).toBe(
            "Bob said earlier."
        );
        expect(rewriteCitations("In Q2 Roadmap [project:18]:", noSources)).toBe("In Q2 Roadmap:");
    });

    it("strips todo and milestone tokens", () => {
        expect(
            rewriteCitations("The decision was deferred [todo:2026-07-03:item:117].", noSources)
        ).toBe("The decision was deferred.");
        expect(rewriteCitations("Targeting v1.0 launch [milestone:7].", noSources)).toBe(
            "Targeting v1.0 launch."
        );
    });

    it("leaves free-form bracketed prose untouched", () => {
        const prose = "A quick note [reminder: ship by Friday] before we go.";
        expect(rewriteCitations(prose, noSources)).toBe(prose);
    });
});

describe("rewriteCitations — natural-prose links (§4.6 D5)", () => {
    it("rewrites a resolved [prose](type:id) link to the sentinel scheme", () => {
        const sources = buildSourcesById([src("task", "task:42", "framer-motion spike")]);
        expect(
            rewriteCitations("The team [ruled out framer-motion](task:42) early.", sources)
        ).toBe(`The team [ruled out framer-motion](${CITATION_HREF_PREFIX}task:42) early.`);
    });

    it("degrades an UNresolved link to plain prose (no dead link)", () => {
        // task:99 is not in the retrieved sources — resolve-guard drops the link.
        const sources = buildSourcesById([src("task", "task:42")]);
        expect(rewriteCitations("See the [mystery task](task:99) here.", sources)).toBe(
            "See the mystery task here."
        );
    });

    it("leaves a real external markdown link untouched", () => {
        // URL doesn't start with a known entity prefix -> not a citation.
        const answer = "Per the [MDN guide](https://developer.mozilla.org) on this.";
        expect(rewriteCitations(answer, noSources)).toBe(answer);
    });

    it("handles a link and a bare-token fallback in the same answer", () => {
        const sources = buildSourcesById([src("note", "note:personal:9", "perf budget")]);
        const out = rewriteCitations(
            "The [perf budget](note:personal:9) holds [task:42].",
            sources
        );
        // Link -> sentinel; bare token -> stripped.
        expect(out).toBe(`The [perf budget](${CITATION_HREF_PREFIX}note:personal:9) holds.`);
    });

    it("resolves a chat link whose entity_id lacks the chat: prefix", () => {
        // buildSourcesById normalises "dm:9:thread:4" -> "chat:dm:9:thread:4".
        const sources = buildSourcesById([src("chat", "dm:9:thread:4", "DM with Bob")]);
        expect(rewriteCitations("Bob [argued against it](chat:dm:9:thread:4).", sources)).toBe(
            `Bob [argued against it](${CITATION_HREF_PREFIX}chat:dm:9:thread:4).`
        );
    });
});

describe("extractInlineCitedIds — link form only", () => {
    it("captures resolved link-form ids and ignores bare tokens", () => {
        const sources = buildSourcesById([
            src("task", "task:42"),
            src("milestone", "milestone:7"),
        ]);
        const answer =
            "The [spike](task:42) and [launch](milestone:7) — but [note:personal:9] is a chip.";
        const ids = extractInlineCitedIds(answer, sources);
        expect(ids.has("task:42")).toBe(true);
        expect(ids.has("milestone:7")).toBe(true);
        // Bare token is stripped → chip, not inline.
        expect(ids.has("note:personal:9")).toBe(false);
    });

    it("does not count an unresolved link (resolve-guard)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        const ids = extractInlineCitedIds("A [ghost](task:99) here.", sources);
        expect(ids.has("task:99")).toBe(false);
    });
});

describe("sourcesNotInline — chips exclude inline-cited", () => {
    it("drops sources already linked inline, keeps the rest", () => {
        const linked = src("task", "task:42", "spike");
        const uncited = src("note", "note:personal:9", "methodology note");
        const answer = "The [spike](task:42) explains it.";
        const chips = sourcesNotInline(answer, [linked, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["note:personal:9"]);
    });

    it("returns all sources when nothing is linked inline (bare tokens only)", () => {
        const a = src("task", "task:42");
        const b = src("note", "note:personal:9");
        // Bare tokens are chips, not inline — both survive.
        const chips = sourcesNotInline("Both [task:42] and [note:personal:9].", [a, b]);
        expect(chips).toHaveLength(2);
    });
});
