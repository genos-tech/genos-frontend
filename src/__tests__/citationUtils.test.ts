import { describe, expect, it } from "vitest";

import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    citedChipSources,
    extractBareCitedIds,
    extractInlineCitedIds,
    rewriteCitations,
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

// Weak-model hardening — every input below is a VERBATIM malformation
// gemini-flash produced in a real run (AgentRun cabd15b1, 2026-07-05):
// links whose label is the raw token itself, and tokens with an invented
// `:msg:<uuid>` suffix that isn't in the citation vocabulary. The
// contract: whatever the model emits, the reader never sees a raw
// token, a UUID, or a leaked `spotlight-citation:` sentinel.
describe("rewriteCitations — weak-model malformed citations", () => {
    it("[token](token): swaps the raw-token label for the source title, keeps the link", () => {
        const sources = buildSourcesById([src("task", "task:1905", "CSS prototype spike")]);
        const out = rewriteCitations("…constraints ([task:1905](task:1905)).", sources);
        // The old strip pattern ate the `[task:1905]` LABEL out of the
        // rewritten link, leaving `…constraints ((spotlight-citation:task:1905)).`
        // — a naked sentinel as visible text. The exact match below proves
        // the label survived and the sentinel stays inside the link URL.
        expect(out).toBe(
            `…constraints ([CSS prototype spike](${CITATION_HREF_PREFIX}task:1905)).`
        );
    });

    it("falls back to a generic type label when the source has no title", () => {
        const sources = buildSourcesById([src("task", "task:1905")]);
        const out = rewriteCitations("Excluded ([task:1905](task:1905)).", sources);
        expect(out).toBe(`Excluded ([Task](${CITATION_HREF_PREFIX}task:1905)).`);
    });

    it("resolves an invented :msg: suffix to the retrieved THREAD source (real run shape)", () => {
        // The malformed run retrieved ONLY the thread source; flash cited a
        // per-message id copied from a tool result. Recovery trims the fake
        // `:msg:` tail to the chat base, then extends to the retrieved
        // thread key — the href carries the CANONICAL key so the anchor's
        // exact lookup works.
        const sources = buildSourcesById([
            src("chat", "dm:0738dbef:thread:8995bd1d", "Bob Martinez"),
        ]);
        const out = rewriteCitations(
            "…significant ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            sources
        );
        expect(out).toBe(
            `…significant ([Bob Martinez](${CITATION_HREF_PREFIX}chat:dm:0738dbef:thread:8995bd1d)).`
        );
    });

    it("resolves an invented :msg: suffix to a retrieved base-chat source too", () => {
        const sources = buildSourcesById([src("chat", "dm:0738dbef", "DM with Bob")]);
        const out = rewriteCitations(
            "…significant ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            sources
        );
        expect(out).toBe(`…significant ([DM with Bob](${CITATION_HREF_PREFIX}chat:dm:0738dbef)).`);
    });

    it("never fuzzy-matches non-chat ids (hallucinated note id stays unresolved)", () => {
        // Structural recovery is chat-only: note:personal:9999 must NOT
        // "recover" to the different note:personal:9.
        const sources = buildSourcesById([src("note", "note:personal:9", "perf budget")]);
        expect(rewriteCitations("Per the [budget note](note:personal:9999).", sources)).toBe(
            "Per the budget note."
        );
    });

    it("drops an unresolvable raw-token-label link entirely (no UUID soup)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        const out = rewriteCitations(
            "…redesign ([chat:dm:0738dbef:msg:63b3b58c](chat:dm:0738dbef:msg:63b3b58c)).",
            sources
        );
        expect(out).toBe("…redesign ().");
    });

    it("keeps a PROSE label when its token is unresolvable (existing degrade)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        expect(rewriteCitations("See the [mystery spike](task:99).", sources)).toBe(
            "See the mystery spike."
        );
    });

    it("still strips a bare token that is not a link label", () => {
        const sources = buildSourcesById([src("task", "task:42", "spike")]);
        // `[task:42]` followed by ` (` (space) is a bare token, not a label.
        expect(rewriteCitations("Per [task:42] (the spike).", sources)).toBe("Per (the spike).");
    });
});

describe("citedChipSources — msg-suffixed citations chip the parent source", () => {
    it("resolves the :msg: token to the retrieved thread and shows its chip", () => {
        const thread = src("chat", "dm:0738dbef:thread:8995bd1d", "Bob Martinez");
        const uncited = src("task", "task:42");
        const chips = citedChipSources(
            "Agreed ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            [thread, uncited]
        );
        expect(chips.map((s) => s.entity_id)).toEqual(["dm:0738dbef:thread:8995bd1d"]);
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

describe("extractBareCitedIds — bare token form only", () => {
    it("captures bare [type:id] tokens and ignores inline links", () => {
        const answer = "A [spike](task:42) link, a [note:personal:9] chip, [milestone:7] too.";
        const ids = extractBareCitedIds(answer);
        // Inline-link id lives in parens → not a bare token.
        expect(ids.has("task:42")).toBe(false);
        expect(ids.has("note:personal:9")).toBe(true);
        expect(ids.has("milestone:7")).toBe(true);
    });

    it("returns an empty set for an answer with no citations", () => {
        expect(extractBareCitedIds("Just prose, no tokens.").size).toBe(0);
    });
});

describe("citedChipSources — cited sources (inline + bare), uncited dropped", () => {
    it("keeps every cited source — inline link OR bare token — and drops uncited", () => {
        const linked = src("task", "task:42", "spike"); // inline link → chip (and prose)
        const bareCited = src("note", "note:personal:9", "methodology"); // bare token → chip
        const uncited = src("project", "project:7", "roadmap"); // retrieved, never cited → dropped
        const answer = "The [spike](task:42) explains it — see [note:personal:9].";
        const chips = citedChipSources(answer, [linked, bareCited, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42", "note:personal:9"]);
    });

    it("keeps a source cited ONLY as an inline link (the empty-chip-row regression)", () => {
        const linked = src("task", "task:42", "spike");
        const uncited = src("note", "note:personal:9");
        // Only an inline link, no bare token — must still produce a chip.
        const chips = citedChipSources("The [spike](task:42) settled it.", [linked, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42"]);
    });

    it("drops uncited retrieved sources (RAG noise)", () => {
        const cited = src("task", "task:42");
        const uncited = src("note", "note:personal:9");
        const chips = citedChipSources("Only [task:42] matters here.", [cited, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42"]);
    });

    it("returns an empty chip row when the answer cites nothing (aggregate/summary)", () => {
        const a = src("task", "task:42");
        const b = src("note", "note:personal:9");
        // e.g. "You have 2 tasks due this week." — prompt exempts aggregate stats from citation.
        expect(citedChipSources("You have 2 tasks due this week.", [a, b])).toEqual([]);
    });

    it("keeps every cited source, incl. a chat entity_id without the chat: prefix", () => {
        const a = src("task", "task:42");
        const b = src("chat", "dm:9:thread:4"); // normalises to chat:dm:9:thread:4 for matching
        const chips = citedChipSources("Both [task:42] and [chat:dm:9:thread:4].", [a, b]);
        expect(chips).toHaveLength(2);
    });
});
