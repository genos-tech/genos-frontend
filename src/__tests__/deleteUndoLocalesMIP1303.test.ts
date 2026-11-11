/**
 * MIP-1303: the task-delete toast ("Task deleted", the milestone twin, and the
 * two "It is back" failure lines) exists in all seven locales.
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
const KEYS = ["deleted", "milestoneDeleted", "errorRestored", "milestoneErrorRestored"] as const;

type Catalog = { tasks?: { deleteUndo?: Record<string, string> } };
const strings = (c: Catalog) => c.tasks?.deleteUndo ?? {};

describe("task delete toast strings", () => {
    it("English has all four", () => {
        for (const key of KEYS) expect(strings(en as Catalog)[key], key).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all four, translated (not the English)`, () => {
            const english = strings(en as Catalog);
            for (const key of KEYS) {
                const value = strings(catalog as Catalog)[key];
                expect(value, `${name}.${key}`).toBeTruthy();
                expect(value, `${name}.${key} is the English text`).not.toBe(english[key]);
            }
        });
    }
});
