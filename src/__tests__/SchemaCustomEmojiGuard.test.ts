/**
 * Schema drift guard for the `customEmoji` inline spec.
 *
 * A body containing an inline type that a reader's schema doesn't register makes BlockNote
 * reject the WHOLE body ("node type not found in schema", see bnChatPreview), so a single
 * missed site breaks rendering of any message/note that carries a custom emoji. Since
 * MIP-1131 the editors share one factory, so the sites are the factory, the headless schema
 * and the paragraph-only comment schema; each must register the spec, in its own form.
 * (`GenosSchema.test.ts` checks the real schemas at runtime too.)
 */
import { describe, expect, it } from "vitest";

import {
    ALLOWED_SCHEMA_SITES,
    HEADLESS_SCHEMA,
    readSrc,
    schemaSites,
} from "./helpers_schemaSites";

describe("customEmoji schema registration guard", () => {
    it("every schema site registers the customEmoji spec", () => {
        const sites = schemaSites();
        expect(sites).toEqual(ALLOWED_SCHEMA_SITES);
        // The headless schema builds from core's `createInlineContentSpec` instead of the
        // editors' React factories, so it can't carry the literal `CreateCustomEmojiSpec()`.
        const offenders = sites.filter((rel) => {
            const text = readSrc(rel);
            return rel === HEADLESS_SCHEMA
                ? !text.includes("customEmoji: createInlineContentSpec(CUSTOM_EMOJI_SPEC_CONFIG")
                : !text.includes("customEmoji: CreateCustomEmojiSpec(),");
        });
        expect(offenders).toEqual([]);
    });
});

describe("headless note schema registration guard", () => {
    // A chip or block added to the editors' schema but not to the headless one makes
    // `applyNoteBodyToYjs` throw on any body that carries it ("node type X not found in
    // schema"). The runtime comparison is in `headlessNoteSchema.test.ts`; this pins that the
    // headless schema registers every chip type the factory lists.
    it("registers every chip type", () => {
        const headless = readSrc(HEADLESS_SCHEMA);
        const missing = [
            "mention",
            "mentionGroup",
            "customEmoji",
            "hashTask",
            "hashNote",
            "hashChat",
            "hashProject",
        ].filter((name) => !headless.includes(`${name}: createInlineContentSpec(`));
        expect(missing).toEqual([]);
        expect(headless).toContain("alert: createBlockSpec(");
    });
});
