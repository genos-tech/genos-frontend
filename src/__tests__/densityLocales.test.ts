/**
 * MIP-1119: the Density setting's strings exist in all seven locales,
 * translated. `DeepPartial<Messages>` lets a locale omit a key and quietly
 * show English, so these read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { settings?: { appearance?: Record<string, string> } };
const KEYS = [
    "densityLabel",
    "densityHelper",
    "densityCompact",
    "densityDefault",
    "densityComfortable",
] as const;
const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const appearance = (c: unknown) => (c as Catalog).settings?.appearance ?? {};

describe("row density strings", () => {
    it("English has all five", () => {
        for (const k of KEYS) expect(appearance(en)[k], k).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all five, translated (not the English)`, () => {
            for (const k of KEYS) {
                expect(appearance(catalog)[k], `${name}.${k}`).toBeTruthy();
                expect(appearance(catalog)[k], `${name}.${k} is the English text`).not.toBe(
                    appearance(en)[k]
                );
            }
        });
    }

    it("the three option labels differ within each locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const labels = [
                appearance(catalog).densityCompact,
                appearance(catalog).densityDefault,
                appearance(catalog).densityComfortable,
            ];
            expect(new Set(labels).size).toBe(3);
        }
    });
});
