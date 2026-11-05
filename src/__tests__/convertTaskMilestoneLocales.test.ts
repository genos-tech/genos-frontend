/**
 * MIP-1042: the conversion strings exist in all seven locales (two labels, and
 * a title and a body for each of the two confirmation dialogs).
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
    convertToTaskTitle: c.tasks?.preview?.menu?.convertToTaskTitle,
    convertToTaskBody: c.tasks?.preview?.menu?.convertToTaskBody,
    convertToMilestone: c.tasks?.titleBlock?.menu?.convertToMilestone,
    convertToMilestoneTitle: c.tasks?.titleBlock?.menu?.convertToMilestoneTitle,
    convertToMilestoneBody: c.tasks?.titleBlock?.menu?.convertToMilestoneBody,
});

describe("conversion strings", () => {
    it("English has all six", () => {
        for (const [key, value] of Object.entries(strings(en as Catalog))) {
            expect(value, key).toBeTruthy();
        }
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all six, translated (not the English)`, () => {
            const english = strings(en as Catalog);
            for (const [key, value] of Object.entries(strings(catalog as Catalog))) {
                expect(value, `${name}.${key}`).toBeTruthy();
                expect(value, `${name}.${key} is the English text`).not.toBe(
                    english[key as keyof typeof english]
                );
            }
        });
    }

    it("the old one-line confirmations are gone from every locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const c = catalog as Catalog;
            expect(c.tasks?.preview?.menu).not.toHaveProperty("convertToTaskConfirm");
            expect(c.tasks?.titleBlock?.menu).not.toHaveProperty("convertToMilestoneConfirm");
        }
    });

    it("each title is a question and each body says what happens, with no stray placeholders", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const s = strings(catalog as Catalog);
            for (const title of [s.convertToTaskTitle, s.convertToMilestoneTitle]) {
                expect(title).toMatch(/[?？؟]$/);
                expect(title).not.toMatch(/[{}]/);
            }
            for (const body of [s.convertToTaskBody, s.convertToMilestoneBody]) {
                expect(body).not.toMatch(/[{}]/);
                // CJK sentences are short; this only rules out an empty or title-sized body.
                expect(body!.length).toBeGreaterThan(15);
                // The question lives in the title; the body is statements.
                expect(body).not.toMatch(/[?？؟]/);
            }
        }
    });
});
