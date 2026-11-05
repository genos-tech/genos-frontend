/**
 * MIP-1042: the four conversion strings exist in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the
 * loader merges every missing key onto English, so a locale that FORGOT a key
 * type-checks and quietly shows English. These read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;

type Catalog = {
    tasks?: {
        preview?: { menu?: Record<string, string> };
        titleBlock?: { menu?: Record<string, string> };
    };
};
const strings = (c: Catalog) => ({
    convertToTask: c.tasks?.preview?.menu?.convertToTask,
    convertToTaskConfirm: c.tasks?.preview?.menu?.convertToTaskConfirm,
    convertToMilestone: c.tasks?.titleBlock?.menu?.convertToMilestone,
    convertToMilestoneConfirm: c.tasks?.titleBlock?.menu?.convertToMilestoneConfirm,
});

describe("conversion strings", () => {
    it("English has all four", () => {
        for (const [key, value] of Object.entries(strings(en as Catalog))) {
            expect(value, key).toBeTruthy();
        }
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all four, translated (not the English)`, () => {
            const english = strings(en as Catalog);
            for (const [key, value] of Object.entries(strings(catalog as Catalog))) {
                expect(value, `${name}.${key}`).toBeTruthy();
                expect(value, `${name}.${key} is the English text`).not.toBe(
                    english[key as keyof typeof english]
                );
            }
        });
    }

    it("the confirmations say what happens to the tasks, in every locale (no stray placeholders)", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const s = strings(catalog as Catalog);
            for (const text of [s.convertToTaskConfirm, s.convertToMilestoneConfirm]) {
                expect(text).not.toMatch(/[{}]/);
                expect(text!.length).toBeGreaterThan(30);
            }
        }
    });
});
