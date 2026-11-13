/**
 * MIP-1405: the month cell's short name (a count) and the hint about Enter exist in all seven
 * locales, translated. `DeepPartial<Messages>` lets a locale omit a key and quietly show
 * English, so these read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { fmt } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { calendar?: Record<string, string> };
const KEYS = ["dayEventCount", "dayEnterOpens", "dayEnterCreates"] as const;
const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const calendar = (c: unknown) => (c as Catalog).calendar ?? {};

describe("calendar keyboard strings", () => {
    it("English has all three, and the count pluralizes", () => {
        for (const k of KEYS) expect(calendar(en)[k], k).toBeTruthy();
        expect(fmt(calendar(en).dayEventCount, { count: 1 })).toBe("1 event");
        expect(fmt(calendar(en).dayEventCount, { count: 3 })).toBe("3 events");
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all three, translated, and the count is filled in`, () => {
            for (const k of KEYS) {
                expect(calendar(catalog)[k], `${name}.${k}`).toBeTruthy();
                expect(calendar(catalog)[k], `${name}.${k}`).not.toBe(calendar(en)[k]);
            }
            expect(fmt(calendar(catalog).dayEventCount, { count: 3 })).toContain("3");
        });
    }
});
