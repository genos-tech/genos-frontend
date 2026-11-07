/**
 * Settings -> Schedules across all seven locales (MIP-1150).
 *
 * A translator may ship a catalog incrementally and the loader fills the rest
 * from English, so a locale that simply FORGOT a key renders an English
 * sentence in the middle of a Japanese page. These tests read the raw catalogs
 * (like `genosMemoryLocales.test.ts`) so that merge cannot hide a gap.
 */
import { describe, expect, it } from "vitest";

import { fmt } from "../i18n/interpolate";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

const keysOf = (node: unknown): string[] =>
    node && typeof node === "object" ? Object.keys(node) : [];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const EN = en.settings.schedules as Record<string, string>;
const ENGLISH_KEYS = Object.keys(EN);

describe("Schedules has every string in every locale", () => {
    it("has a page worth testing", () => {
        expect(ENGLISH_KEYS.length).toBeGreaterThan(60);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = keysOf(OTHERS[name].settings?.schedules);
        expect({ locale: name, missing: ENGLISH_KEYS.filter((k) => !own.includes(k)) }).toEqual({
            locale: name,
            missing: [],
        });
        expect({ locale: name, extra: own.filter((k) => !ENGLISH_KEYS.includes(k)) }).toEqual({
            locale: name,
            extra: [],
        });
    });

    it.each(NAMES)("%s is translated, not copied from English", (name) => {
        const own = OTHERS[name].settings?.schedules as Record<string, string>;
        const untouched = ENGLISH_KEYS.filter((k) => EN[k].length > 40 && own[k] === EN[k]);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const own = OTHERS[name].settings?.schedules as Record<string, string>;
        const broken = ENGLISH_KEYS.filter(
            (k) =>
                own[k] === undefined || placeholders(own[k]).join() !== placeholders(EN[k]).join()
        );
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });

    it.each(NAMES)("%s has no empty string", (name) => {
        const own = OTHERS[name].settings?.schedules as Record<string, string>;
        expect(Object.entries(own).filter(([, v]) => v.trim() === "")).toEqual([]);
    });

    it.each(NAMES)("%s renders its result sentence with the title and count", (name) => {
        const own = OTHERS[name].settings?.schedules as Record<string, string>;
        const one = fmt(own.lastResult, { title: "TITLE", count: 1 });
        const many = fmt(own.lastResult, { title: "TITLE", count: 3 });
        for (const text of [one, many]) {
            expect(text).toContain("TITLE");
            expect(text).not.toMatch(/[{}]|plural/);
        }
        expect(one).toContain("1");
        expect(many).toContain("3");
    });
});
