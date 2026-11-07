/**
 * Every schema knows the math and diagram blocks (MIP-1019), and since MIP-1131 that is
 * guaranteed by construction rather than by scanning 15 wrappers.
 *
 * An editor whose schema lacks a block type DELETES that block from the shared Yjs document
 * when it opens a document that holds one (y-prosemirror drops an element it cannot build,
 * and the deletion syncs to everyone). So a type cannot be in some editors only. All editors
 * now take their schema from `genos/genosSchema.ts`, which starts from `genosSchemaParts`
 * (which holds `genosExtraBlockSpecs` and `genosExtraInlineContentSpecs`). The headless
 * schema starts from the same parts. This guard fails the build if a NEW file builds a
 * schema of its own, which is how a type would get left out again. (The previous guard
 * counted `BlockNoteSchema.create` sites in every wrapper and asserted at least 15; the
 * factory made that count 3, so it became an exact allowlist, not a lower number.
 * `GenosSchema.test.ts` checks the real schemas at runtime.)
 *
 * The one deliberate exception is the schema of BlockNote's own comment composer: it is
 * paragraph-only by design and its documents are comment threads, which the API never
 * writes math into.
 */
import { describe, expect, it } from "vitest";

import {
    ALLOWED_SCHEMA_SITES,
    COMMENT_SCHEMA,
    HEADLESS_SCHEMA,
    readSrc,
    SCHEMA_FACTORY,
    schemaSites,
} from "./helpers_schemaSites";

describe("math and diagram blocks guard", () => {
    it("only the factory, the headless schema and the comment schema build a schema", () => {
        expect(schemaSites()).toEqual(ALLOWED_SCHEMA_SITES);
    });

    it("the factory and the headless schema both start from the shared parts", () => {
        for (const rel of [SCHEMA_FACTORY, HEADLESS_SCHEMA]) {
            const text = readSrc(rel);
            expect(text).toContain("...genosBaseBlockSpecs()");
            expect(text).toContain("...genosBaseInlineContentSpecs()");
        }
        const parts = readSrc("components/editors/genos/genosSchemaParts.ts");
        expect(parts).toContain("...genosExtraBlockSpecs");
        expect(parts).toContain("...genosExtraInlineContentSpecs");
    });

    it("the paragraph-only exception still is paragraph-only", () => {
        const text = readSrc(COMMENT_SCHEMA);
        expect(text).toMatch(/blockSpecs:\s*\{\s*paragraph:/);
        expect(text).not.toContain("genosExtraBlockSpecs");
    });

    it("the shared parts import no CSS (the compat tool loads them in plain Node)", () => {
        expect(readSrc("components/editors/genosBlockSpecs.ts")).not.toMatch(
            /import\s+["'][^"']+\.css["']/
        );
        expect(readSrc("components/editors/genos/genosSchemaParts.ts")).not.toMatch(
            /import\s+["'][^"']+\.css["']/
        );
    });
});
