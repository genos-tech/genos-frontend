import { describe, expect, it } from "vitest";

import { extractInlineCitedIds, rewriteCitations } from "../features/agentQA/citationUtils";
import type { SpotlightResult } from "../features/spotlight/types";

// The strip path never consults the sources map (chips-only rule), so an
// empty map is sufficient for these cases.
const noSources = new Map<string, SpotlightResult>();

describe("rewriteCitations — inline token stripping", () => {
    // Regression guard: the four original entity types must keep stripping.
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

    // The reported bug: a todo citation left its raw token in the prose
    // because `todo` was absent from the strip vocabulary.
    it("strips todo tokens (the reported bug)", () => {
        expect(
            rewriteCitations("The decision was deferred [todo:2026-07-03:item:117].", noSources)
        ).toBe("The decision was deferred.");
    });

    it("strips milestone tokens (the same latent bug)", () => {
        expect(rewriteCitations("Targeting v1.0 launch [milestone:7].", noSources)).toBe(
            "Targeting v1.0 launch."
        );
    });

    // The false-positive guard the enumerated prefix set exists to protect:
    // a bracketed phrase that isn't a citation must survive untouched.
    it("leaves free-form bracketed prose untouched", () => {
        const prose = "A quick note [reminder: ship by Friday] before we go.";
        expect(rewriteCitations(prose, noSources)).toBe(prose);
    });
});

describe("extractInlineCitedIds — token vocabulary", () => {
    it("captures todo and milestone ids alongside the original types", () => {
        const answer = "Deferred [todo:2026-07-03:item:117], see [task:42] and [milestone:7].";
        const ids = extractInlineCitedIds(answer);
        expect(ids.has("todo:2026-07-03:item:117")).toBe(true);
        expect(ids.has("milestone:7")).toBe(true);
        expect(ids.has("task:42")).toBe(true);
    });
});
