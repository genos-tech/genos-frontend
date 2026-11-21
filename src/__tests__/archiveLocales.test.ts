/**
 * Every archive string (MIP-1693) exists in all seven locales, and the 409 toast too.
 *
 * `DeepPartial<Messages>` lets a locale omit a key and silently show English, so this reads
 * the raw catalogs and compares every leaf of `en.common.archive` and `en.app.snackbar.archived`
 * with the other six. The drafts stay marked `TODO(copy): MIP-1693` in the source for a native reader.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ar, es, fr, hi, ja, zh } as const;
const HERE = dirname(fileURLToPath(import.meta.url));

type Bag = Record<string, unknown>;

const archiveLeaves = (catalog: Bag): string[] => {
    const common = catalog.common as Bag | undefined;
    const archive = (common?.archive ?? {}) as Bag;
    return Object.keys(archive);
};

describe("archive copy (MIP-1693)", () => {
    const enKeys = archiveLeaves(en as unknown as Bag);

    it("has archive keys in English", () => {
        expect(enKeys.length).toBeGreaterThan(10);
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`has every archive key in ${name}`, () => {
            const archive = ((catalog as unknown as Bag).common as Bag | undefined)?.archive as
                | Bag
                | undefined;
            expect(archive, `${name} common.archive`).toBeDefined();
            for (const key of enKeys) {
                const value = archive?.[key];
                expect(typeof value, `${name} common.archive.${key}`).toBe("string");
                expect((value as string).trim().length, `${name} ${key}`).toBeGreaterThan(0);
            }
        });

        it(`has the archived 409 toast in ${name}`, () => {
            const snackbar = ((catalog as unknown as Bag).app as Bag | undefined)?.snackbar as
                | Bag
                | undefined;
            expect(typeof snackbar?.archived).toBe("string");
        });
    }

    it("marks the English drafts for a native reader", () => {
        const source = readFileSync(join(HERE, "../i18n/locales/en/common.ts"), "utf8");
        expect(source).toContain("TODO(copy): MIP-1693");
    });
});
