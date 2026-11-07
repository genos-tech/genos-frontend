/**
 * Every schema uses `genosStyleSpecs` (MIP-1009).
 *
 * A schema built from BlockNote's own styles rejects a body that has inline code
 * combined with another style (BlockNote 0.57 throws "Invalid collection of marks
 * for node text: bold,code" when it is loaded), and production has 310 such
 * messages, comments and task bodies. Since MIP-1131 only three files may build a
 * schema (`helpers_schemaSites`), and this checks that each starts its styles from
 * `genosStyleSpecs`; `BlockSpecsGuard` fails when a fourth file appears.
 */
import { describe, expect, it } from "vitest";

import { ALLOWED_SCHEMA_SITES, readSrc, schemaSites } from "./helpers_schemaSites";

// The comment schema starts from `genosStyleSpecs` and drops the color styles.
const USES_THEM = /styleSpecs:\s*genosStyleSpecs|\.\.\.styleSpecs\s*\}\s*=\s*genosStyleSpecs/;

describe("genosStyleSpecs guard", () => {
    it("every schema site builds its styles from genosStyleSpecs", () => {
        const sites = schemaSites();
        expect(sites).toEqual(ALLOWED_SCHEMA_SITES);
        expect(sites.filter((rel) => !USES_THEM.test(readSrc(rel)))).toEqual([]);
    });
});
