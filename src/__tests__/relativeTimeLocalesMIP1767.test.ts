/**
 * MIP-1767: Japanese relative times read wrong ("1 day ago" -> "11 日前", one
 * week -> "12 日前", "d 前" with a Latin letter in the middle of Japanese).
 * Cause: stray characters typed into the translated templates, not the
 * formatters. A locale may omit or mistype a template and still typecheck, so
 * this reads the raw catalogs and RENDERS every relative-time template the app
 * has, in all seven locales, for a range of counts:
 *
 *  - the only digits in the rendered text are the count's own (a stray "1" or
 *    "2" in a template fails here, whatever the unit). For a count of 1 a locale
 *    may use a word instead ("قبل دقيقة", "a minute ago"), so no digit is fine;
 *  - ja and zh carry no Latin letters outside a placeholder (the "d", "w", "y"
 *    unit letters of the English short form are not Japanese or Chinese);
 *  - English reads "1 day ago" / "2 days ago" in every plural-aware family.
 *
 * MIP-1775 adds the part digits cannot see, for es, fr, ar and hi: where the
 * count sits in the sentence ("hace 5 minutos", "il y a 5 minutes", "منذ 5
 * دقائق", "5 मिनट पहले"), no line break in a one-line label, no Latin unit
 * letters inside Arabic or Devanagari text, and the exact feed wording.
 */
import { describe, expect, it } from "vitest";

import { formatRelativeAge } from "../features/tasks/utils/relativeAge";
import { fmt } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const catalogs = { en, ja, zh, es, fr, hi, ar } as unknown as Record<string, unknown>;

const read = (catalog: unknown, path: string): string | undefined => {
    let node: unknown = catalog;
    for (const part of path.split(".")) {
        if (node === null || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : undefined;
};

// Every relative-time template: where it lives, and whether a count is placed.
const FAMILIES: Record<string, string[]> = {
    "history.relative": ["minutes", "hours", "days", "weeks", "months", "years"],
    "tasks.activity": ["minuteAgo", "minutesAgo", "hourAgo", "hoursAgo", "dayAgo", "daysAgo"],
    "common.editor.commentsSidebar": ["minutesAgo", "hoursAgo", "daysAgo"],
    "notes.history.relTime": [
        "minutes",
        "hours",
        "days",
        "minutesShort",
        "hoursShort",
        "daysShort",
    ],
    "spotlight.history": ["relativeMinutes", "relativeHours", "relativeDays"],
    "threadAsk.summary": ["updatedMinutes", "updatedHours", "updatedDays"],
    "noteAsk.summary": ["updatedMinutes", "updatedHours", "updatedDays"],
};
// Fixed text with the count baked in.
const FIXED_ONE = ["notes.history.relTime.oneMinute", "notes.history.relTime.oneMinShort"];

const UNITS = [
    "second",
    "seconds",
    "minute",
    "minutes",
    "hour",
    "hours",
    "day",
    "days",
    "week",
    "weeks",
    "month",
    "months",
    "year",
    "years",
] as const;
const COUNTS = [1, 2, 3, 5, 7, 11, 12, 24, 30, 45, 59];

const stripPlaceholders = (template: string) =>
    template
        .replace(/\{\w+,\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g, "$1 $2")
        .replace(/\{\w+\}/g, "")
        .replace(/#/g, "");

const render = (template: string, count: number) => fmt(template, { count, n: count, unit: "" });

// The digits a rendered line may carry: the count's own, or none for a count of
// 1 said as a word.
const onlyTheCount = (out: string, count: number) => {
    const digits = out.replace(/\D/g, "");
    return digits === String(count) || (count === 1 && digits === "");
};

describe("relative-time templates, every locale", () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
        describe(locale, () => {
            for (const [family, keys] of Object.entries(FAMILIES)) {
                for (const key of keys) {
                    it(`${family}.${key} shows only the count's digits`, () => {
                        const template = read(catalog, `${family}.${key}`);
                        expect(template, "template is missing").toBeTruthy();
                        for (const count of COUNTS) {
                            const out = render(template as string, count);
                            expect(onlyTheCount(out, count), `"${out}" for ${count}`).toBe(true);
                        }
                    });
                }
            }

            it("the one-minute lines say 1 and nothing else numeric", () => {
                for (const path of FIXED_ONE) {
                    const text = read(catalog, path);
                    expect(text, path).toBeTruthy();
                    expect(onlyTheCount(text as string, 1), path).toBe(true);
                }
            });

            it("integrations.pullRequest.hover.ago reads right for every unit", () => {
                const ago = read(catalog, "integrations.pullRequest.hover.ago");
                expect(ago).toBeTruthy();
                for (const unit of UNITS) {
                    const word = read(catalog, `integrations.pullRequest.hover.units.${unit}`);
                    expect(word, unit).toBeTruthy();
                    expect((word as string).replace(/\d/g, ""), `${unit} unit word`).toBe(word);
                    for (const count of [1, 2, 12]) {
                        const out = fmt(ago as string, { count, unit: word as string });
                        expect(onlyTheCount(out, count), `"${out}"`).toBe(true);
                    }
                }
            });
        });
    }
});

describe("ja and zh relative times are written in Japanese and Chinese", () => {
    const paths = [
        ...Object.entries(FAMILIES).flatMap(([family, keys]) =>
            keys.map((key) => `${family}.${key}`)
        ),
        ...FIXED_ONE,
        "integrations.pullRequest.hover.ago",
        ...UNITS.map((unit) => `integrations.pullRequest.hover.units.${unit}`),
    ];
    for (const locale of ["ja", "zh"]) {
        it(`${locale} has no Latin letters outside a placeholder`, () => {
            const offenders = paths.filter((path) =>
                /[A-Za-z]/.test(stripPlaceholders(read(catalogs[locale], path) ?? ""))
            );
            expect(offenders).toEqual([]);
        });
    }
});

describe("English reads singular and plural", () => {
    it("plural-aware families", () => {
        for (const [family, keys] of [
            ["common.editor.commentsSidebar", ["minutesAgo", "hoursAgo", "daysAgo"]],
            ["spotlight.history", ["relativeMinutes", "relativeHours", "relativeDays"]],
        ] as const) {
            for (const key of keys) {
                const template = read(en, `${family}.${key}`) as string;
                expect(render(template, 1), key).toMatch(/^1 \w+ ago$/);
                expect(render(template, 1), key).not.toMatch(/\bs ago$/);
                expect(render(template, 2), key).toMatch(/^2 \w+s ago$/);
            }
        }
    });

    it("the activity feed's singular and plural wording", () => {
        const a = (key: string) => read(en, `tasks.activity.${key}`) as string;
        expect(render(a("minuteAgo"), 1)).toBe("1 minute ago");
        expect(render(a("hourAgo"), 1)).toBe("1 hour ago");
        expect(render(a("dayAgo"), 1)).toBe("1 day ago");
        expect(render(a("daysAgo"), 3)).toBe("3 days ago");
    });
});

describe("formatRelativeAge over every unit it covers (the activity feed)", () => {
    const NOW = Date.parse("2026-11-20T12:00:00Z");
    const ago = (ms: number) => new Date(NOW - ms).toISOString();
    const MIN = 60_000;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;
    const messages = (locale: string) => {
        const key = (k: string) => read(catalogs[locale], `tasks.activity.${k}`) as string;
        return {
            justNow: key("justNow"),
            minuteAgo: key("minuteAgo"),
            minutesAgo: key("minutesAgo"),
            hourAgo: key("hourAgo"),
            hoursAgo: key("hoursAgo"),
            dayAgo: key("dayAgo"),
            daysAgo: key("daysAgo"),
        };
    };
    const cases: [string, number, string, string][] = [
        ["seconds", 20_000, "just now", "今"],
        ["1 minute", MIN, "1 minute ago", "1 分前"],
        ["5 minutes", 5 * MIN, "5 minutes ago", "5 分前"],
        ["1 hour", HOUR, "1 hour ago", "1 時間前"],
        ["3 hours", 3 * HOUR, "3 hours ago", "3 時間前"],
        ["1 day", DAY, "1 day ago", "1 日前"],
        ["3 days", 3 * DAY, "3 days ago", "3 日前"],
        ["6 days", 6 * DAY, "6 days ago", "6 日前"],
    ];
    for (const [name, ms, enText, jaText] of cases) {
        it(`${name}: en "${enText}", ja "${jaText}"`, () => {
            expect(formatRelativeAge(ago(ms), messages("en"), NOW)).toBe(enText);
            expect(formatRelativeAge(ago(ms), messages("ja"), NOW)).toBe(jaText);
        });
    }
});

// ---------------------------------------------------------------------------
// MIP-1775: placement and script, es / fr / ar / hi
// ---------------------------------------------------------------------------

const ALL_PATHS = [
    ...Object.entries(FAMILIES).flatMap(([family, keys]) => keys.map((key) => `${family}.${key}`)),
    ...FIXED_ONE,
    "integrations.pullRequest.hover.ago",
    ...UNITS.map((unit) => `integrations.pullRequest.hover.units.${unit}`),
];

describe("no relative-time template breaks the line", () => {
    for (const locale of Object.keys(catalogs)) {
        it(`${locale} has no newline in any relative-time template`, () => {
            const offenders = ALL_PATHS.filter((path) =>
                /[\r\n]/.test(read(catalogs[locale], path) ?? "")
            );
            expect(offenders).toEqual([]);
        });
    }
});

describe("ar and hi relative times carry no Latin letters outside a placeholder", () => {
    for (const locale of ["ar", "hi"]) {
        it(`${locale}`, () => {
            const offenders = ALL_PATHS.filter((path) =>
                /[A-Za-z]/.test(stripPlaceholders(read(catalogs[locale], path) ?? ""))
            );
            expect(offenders).toEqual([]);
        });
    }
});

// Where the count sits for a count of 5, per language: after "hace" / "il y a" /
// "منذ" / "قبل", and before "पहले". Every unit form (long and short) counts.
const PLACEMENT: Record<string, RegExp> = {
    es: /^(?:actualizado )?hace 5(?:\s|$)/i,
    fr: /^(?:mis à jour )?il y a 5(?:\s|$)/i,
    ar: /^(?:حُدّث )?(?:منذ|قبل) 5(?!\d)/,
    hi: /^5\S*(?: \S+)* पहले(?: अपडेट किया गया)?$|^5\S*(?: \S+)* पहले अपडेट किया गया$/,
};

describe("the count sits inside the phrase", () => {
    for (const locale of Object.keys(PLACEMENT)) {
        describe(locale, () => {
            for (const path of ALL_PATHS.filter(
                (p) =>
                    !p.includes("hover.units") &&
                    !p.includes("oneMinute") &&
                    !p.includes("oneMinShort")
            )) {
                it(`${path} for 5`, () => {
                    const template = read(catalogs[locale], path) as string;
                    const out =
                        path === "integrations.pullRequest.hover.ago"
                            ? fmt(template, {
                                  count: 5,
                                  unit: read(
                                      catalogs[locale],
                                      "integrations.pullRequest.hover.units.minutes"
                                  ) as string,
                              })
                            : render(template, 5);
                    expect(out, path).toMatch(PLACEMENT[locale]);
                });
            }
        });
    }

    it("the PR hover card names the unit right (fr minute, hi second, fr year)", () => {
        const unit = (locale: string, key: string) =>
            read(catalogs[locale], `integrations.pullRequest.hover.units.${key}`);
        expect(unit("fr", "minute")).toBe("minute");
        expect(unit("fr", "minutes")).toBe("minutes");
        expect(unit("fr", "year")).toBe("an");
        expect(unit("hi", "second")).toBe("सेकंड");
    });

    const hover = (locale: string, count: number, unit: string) =>
        fmt(read(catalogs[locale], "integrations.pullRequest.hover.ago") as string, {
            count,
            unit: read(catalogs[locale], `integrations.pullRequest.hover.units.${unit}`) as string,
        });
    it("the PR hover card reads as a sentence", () => {
        expect(hover("es", 5, "minutes")).toBe("hace 5 minutos");
        expect(hover("fr", 5, "minutes")).toBe("il y a 5 minutes");
        expect(hover("fr", 1, "minute")).toBe("il y a 1 minute");
        expect(hover("fr", 3, "years")).toBe("il y a 3 ans");
        expect(hover("ar", 5, "minutes")).toBe("منذ 5 دقائق");
        expect(hover("hi", 5, "minutes")).toBe("5 मिनट पहले");
        expect(hover("hi", 1, "second")).toBe("1 सेकंड पहले");
    });
});

describe("the History modal's labels are one line in es, fr, ar and hi", () => {
    const rel = (locale: string, key: string, count: number) =>
        render(read(catalogs[locale], `history.relative.${key}`) as string, count);
    it("fr", () => {
        expect(read(fr, "history.relative.justNow")).toBe("À l'instant");
        expect(rel("fr", "minutes", 5)).toBe("Il y a 5 min");
        expect(rel("fr", "hours", 3)).toBe("Il y a 3 h");
        expect(rel("fr", "days", 2)).toBe("Il y a 2 j");
        expect(rel("fr", "months", 2)).toBe("Il y a 2 mois");
        expect(rel("fr", "years", 1)).toBe("Il y a 1 an");
        expect(rel("fr", "years", 3)).toBe("Il y a 3 ans");
    });
    it("es puts hace first, also for months", () => {
        expect(rel("es", "minutes", 5)).toBe("Hace 5 min");
        expect(rel("es", "months", 1)).toBe("Hace 1 mes");
        expect(rel("es", "months", 4)).toBe("Hace 4 meses");
        expect(rel("es", "years", 2)).toBe("Hace 2 años");
    });
    it("ar reads right to left, in Arabic words", () => {
        expect(rel("ar", "minutes", 5)).toBe("منذ 5 دقائق");
        expect(rel("ar", "days", 1)).toBe("منذ يوم");
        expect(rel("ar", "months", 3)).toBe("منذ 3 أشهر");
    });
    it("hi puts the unit after the count, in Devanagari", () => {
        expect(rel("hi", "minutes", 5)).toBe("5 मिनट पहले");
        expect(rel("hi", "hours", 1)).toBe("1 घंटा पहले");
        expect(rel("hi", "days", 3)).toBe("3 दिन पहले");
    });
});

describe("the activity feed reads as a native sentence (es, fr, ar, hi)", () => {
    const NOW = Date.parse("2026-11-20T12:00:00Z");
    const ago = (ms: number) => new Date(NOW - ms).toISOString();
    const MIN = 60_000;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;
    const messages = (locale: string) => {
        const key = (k: string) => read(catalogs[locale], `tasks.activity.${k}`) as string;
        return {
            justNow: key("justNow"),
            minuteAgo: key("minuteAgo"),
            minutesAgo: key("minutesAgo"),
            hourAgo: key("hourAgo"),
            hoursAgo: key("hoursAgo"),
            dayAgo: key("dayAgo"),
            daysAgo: key("daysAgo"),
        };
    };
    // 1 minute, 5 minutes, 1 hour, 3 hours, 1 day, 3 days
    const expected: Record<string, string[]> = {
        es: [
            "hace 1 minuto",
            "hace 5 minutos",
            "hace 1 hora",
            "hace 3 horas",
            "hace 1 día",
            "hace 3 días",
        ],
        fr: [
            "il y a 1 minute",
            "il y a 5 minutes",
            "il y a 1 heure",
            "il y a 3 heures",
            "il y a 1 jour",
            "il y a 3 jours",
        ],
        ar: ["منذ دقيقة", "منذ 5 دقائق", "منذ ساعة", "منذ 3 ساعات", "منذ يوم", "منذ 3 أيام"],
        hi: [
            "1 मिनट पहले",
            "5 मिनट पहले",
            "1 घंटा पहले",
            "3 घंटे पहले",
            "1 दिन पहले",
            "3 दिन पहले",
        ],
    };
    const spans = [MIN, 5 * MIN, HOUR, 3 * HOUR, DAY, 3 * DAY];
    for (const [locale, lines] of Object.entries(expected)) {
        it(locale, () => {
            expect(spans.map((ms) => formatRelativeAge(ago(ms), messages(locale), NOW))).toEqual(
                lines
            );
        });
    }
});

describe('"just now" uses the catalog\'s own wording in es, fr and hi (MIP-1775)', () => {
    const justNow = (locale: string, path: string) => read(catalogs[locale], path);
    it("the activity feed", () => {
        expect(justNow("es", "tasks.activity.justNow")).toBe("justo ahora");
        expect(justNow("fr", "tasks.activity.justNow")).toBe("à l'instant");
        expect(justNow("hi", "tasks.activity.justNow")).toBe("अभी-अभी");
    });
    it("the History modal", () => {
        expect(justNow("es", "history.relative.justNow")).toBe("Justo ahora");
        expect(justNow("hi", "history.relative.justNow")).toBe("अभी-अभी");
    });
});
