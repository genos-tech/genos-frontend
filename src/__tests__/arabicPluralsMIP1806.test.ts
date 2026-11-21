/**
 * MIP-1806: Arabic relative times used one/other only ("منذ 45 دقائق", "منذ 2
 * دقائق"). `fmt` now resolves plurals that name zero/two/few/many with
 * `Intl.PluralRules` for the active locale; one/other-only plurals keep the old
 * `n === 1` rule in every locale, so the other six locales are unchanged.
 *
 * The Arabic wording is a DRAFT (TODO(copy): MIP-1806): no native reader has
 * checked it. These tests pin the grammar rule (2 = dual, 3-10 plural noun, 11-99
 * and 100+ singular noun), not the final copy.
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

// `ar` is a partial catalog: read by path, as a string.
const arText = (path: string): string => {
    let node: unknown = ar;
    for (const part of path.split(".")) node = (node as Record<string, unknown>)[part];
    return node as string;
};

const COUNTS = [0, 1, 2, 3, 5, 10, 11, 45, 99, 100, 101, 102, 111];

// [unit, one, dual, few (3-10), singular noun (11+)]
const NOUNS: Record<string, [string, string, string, string]> = {
    minutes: ["دقيقة", "دقيقتين", "دقائق", "دقيقة"],
    hours: ["ساعة", "ساعتين", "ساعات", "ساعة"],
    days: ["يوم", "يومين", "أيام", "يومًا"],
    weeks: ["أسبوع", "أسبوعين", "أسابيع", "أسبوعًا"],
    months: ["شهر", "شهرين", "أشهر", "شهرًا"],
    years: ["سنة", "سنتين", "سنوات", "سنة"],
};

const expected = (unit: string, n: number): string => {
    const [one, dual, few, many] = NOUNS[unit];
    if (n === 1) return `منذ ${one}`;
    if (n === 2) return `منذ ${dual}`;
    if (n >= 3 && n <= 10) return `منذ ${n} ${few}`;
    const mod = n % 100;
    if (mod >= 3 && mod <= 10) return `منذ ${n} ${few}`;
    return `منذ ${n} ${many}`;
};

describe("Arabic history.relative, every count and unit", () => {
    for (const unit of Object.keys(NOUNS)) {
        it(unit, () => {
            const tpl = arText(`history.relative.${unit}`);
            const table = COUNTS.map((n) => [n, fmt(tpl, { count: n }, "ar")]);
            expect(table).toEqual(COUNTS.map((n) => [n, expected(unit, n)]));
        });
    }
});

describe("Arabic task activity and the other families", () => {
    const render = (path: string, n: number, key = "count") =>
        fmt(arText(path), { [key]: n }, "ar");
    it.each([
        ["tasks.activity.minutesAgo", "minutes"],
        ["tasks.activity.hoursAgo", "hours"],
        ["tasks.activity.daysAgo", "days"],
    ])("%s", (path, unit) => {
        for (const n of COUNTS.filter((c) => c !== 1 && c !== 0)) {
            expect(render(path, n)).toBe(expected(unit, n));
        }
    });
    it("2 minutes is the dual, 45 minutes the singular noun", () => {
        expect(render("tasks.activity.minutesAgo", 2)).toBe("منذ دقيقتين");
        expect(render("tasks.activity.minutesAgo", 45)).toBe("منذ 45 دقيقة");
        expect(render("tasks.activity.minutesAgo", 5)).toBe("منذ 5 دقائق");
        expect(render("tasks.activity.minutesAgo", 11)).toBe("منذ 11 دقيقة");
    });
    it("notes history reads the dual and the 11+ noun", () => {
        expect(render("notes.history.relTime.minutes", 2, "n")).toBe("قبل دقيقتين");
        expect(render("notes.history.relTime.hours", 45, "n")).toBe("قبل 45 ساعة");
        expect(render("notes.history.relTime.days", 5, "n")).toBe("قبل 5 أيام");
    });
    it("PR hover card unit words carry the count", () => {
        const ago = arText("integrations.pullRequest.hover.ago");
        const word = (u: string, n: number) =>
            fmt(arText(`integrations.pullRequest.hover.units.${u}`), { count: n }, "ar");
        expect(fmt(ago, { count: 2, unit: word("minutes", 2) }, "ar")).toBe("منذ دقيقتين");
        expect(fmt(ago, { count: 45, unit: word("minutes", 45) }, "ar")).toBe("منذ 45 دقيقة");
        expect(fmt(ago, { count: 1, unit: word("minute", 1) }, "ar")).toBe("منذ دقيقة");
    });
});

describe("other locales are unchanged by the extended formatter", () => {
    const sample = (c: unknown) => JSON.stringify(c);
    it("one/other plurals still use n === 1, in any locale (fr 0 stays plural)", () => {
        const t = "{count, plural, one {# jour} other {# jours}}";
        for (const loc of ["en", "ja", "zh", "es", "fr", "hi", "ar"]) {
            expect(fmt(t, { count: 0 }, loc)).toBe("0 jours");
            expect(fmt(t, { count: 1 }, loc)).toBe("1 jour");
            expect(fmt(t, { count: 2 }, loc)).toBe("2 jours");
        }
    });
    it("en/ja/zh/es/fr/hi catalogs use no category beyond one/other", () => {
        for (const c of [en, ja, zh, es, fr, hi]) {
            expect(sample(c)).not.toMatch(/\b(zero|two|few|many)\s*\{/);
        }
    });
    it("a missing category falls back to other", () => {
        expect(fmt("{n, plural, two {A} other {B}}", { n: 5 }, "ar")).toBe("B");
    });
});
