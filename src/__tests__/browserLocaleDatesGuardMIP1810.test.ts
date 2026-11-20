// @vitest-environment node
/**
 * MIP-1810: a date the app writes follows the app's language, not the browser's.
 *
 * `d.toLocaleDateString(undefined, ...)`, `d.toLocaleString()` and `new Intl.DateTimeFormat()`
 * with no tag all use the BROWSER's language, so an Arabic app on an English browser wrote
 * "Nov 15" in a dozen places (MIP-1807, MIP-1810; the calendar had the same bug in #779). The
 * locale chosen in Settings is `useTranslation().locale`, a valid `Intl` tag; a pure helper
 * takes it from its callers. So a new such call in `src` fails this test: pass the app's
 * locale, or, if the site must follow the browser, add the file to ALLOWED with the reason.
 *
 * Not matched on purpose: `localeCompare(b, undefined, ...)` (sorting, not a date) and
 * `Intl.DateTimeFormat().resolvedOptions()` (reads the browser's TIME ZONE, not a label).
 *
 * Counts are upper bounds: a fixed site lowers the number (the list is not an exact ratchet,
 * so two PRs that fix neighbouring sites can merge in either order).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** file (relative to src, forward slashes) -> the most such calls it may hold, and why. */
const ALLOWED: Record<string, { max: number; why: string }> = {
    // The two sites below are fixed in PR #1060 (MIP-1807), which is not on main yet. They
    // are listed so this guard passes on main as well as on a merge with that PR (max, not
    // exact: they are 0 once it lands).
    "features/tasks/utils/relativeAge.ts": {
        max: 1,
        why: "fixed in PR #1060, remove this entry after it merges",
    },
    "features/tasks/components/MilestoneCardBody.tsx": {
        max: 1,
        why: "fixed in PR #1060, remove this entry after it merges",
    },
};

// A date or time written with no locale tag (or `undefined`): the browser's language.
const DATE_TO_LOCALE = /\.toLocale(?:Date|Time)?String\(\s*(?:undefined\s*[,)]|\))/g;
const INTL_NO_TAG =
    /\bIntl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat|ListFormat)\(\s*(?:undefined\s*[,)]|\)(?!\s*\.resolvedOptions))/g;

const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            walk(full, out);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

const countBrowserLocaleDates = (text: string): number => {
    const code = stripComments(text);
    return (code.match(DATE_TO_LOCALE)?.length ?? 0) + (code.match(INTL_NO_TAG)?.length ?? 0);
};

describe("dates are written in the app's language, never the browser's", () => {
    const found: Record<string, number> = {};
    for (const file of walk(SRC)) {
        const n = countBrowserLocaleDates(fs.readFileSync(file, "utf8"));
        if (n > 0) found[path.relative(SRC, file).split(path.sep).join("/")] = n;
    }

    it("no file outside the allowed list formats a date with the browser's locale", () => {
        const unknown = Object.keys(found).filter((f) => !(f in ALLOWED));
        expect(
            unknown,
            `Browser-locale date in ${unknown.join(", ")}. Pass the app's locale (const { locale } = useTranslation(), or a locale argument from the caller), or add the file to ALLOWED in browserLocaleDatesGuardMIP1810.test.ts with a reason.`
        ).toEqual([]);
    });

    it("an allowed file does not hold more than it may", () => {
        for (const [file, { max, why }] of Object.entries(ALLOWED)) {
            expect(found[file] ?? 0, `${file}: ${why}`).toBeLessThanOrEqual(max);
        }
    });

    it("catches the forms that follow the browser, including a multi-line call", () => {
        expect(
            countBrowserLocaleDates("d.toLocaleDateString(undefined, { month: 'short' })")
        ).toBe(1);
        expect(countBrowserLocaleDates("d.toLocaleDateString()")).toBe(1);
        expect(countBrowserLocaleDates("d.toLocaleString()")).toBe(1);
        expect(countBrowserLocaleDates("d.toLocaleTimeString(undefined)")).toBe(1);
        expect(
            countBrowserLocaleDates(
                "d.toLocaleString(\n    undefined,\n    { hour: 'numeric' }\n)"
            )
        ).toBe(1);
        expect(countBrowserLocaleDates("new Intl.DateTimeFormat(undefined, o).format(d)")).toBe(1);
        expect(countBrowserLocaleDates("new Intl.DateTimeFormat().format(d)")).toBe(1);
        expect(countBrowserLocaleDates("new Intl.RelativeTimeFormat(undefined)")).toBe(1);
        expect(countBrowserLocaleDates("new Intl.NumberFormat(\n undefined\n)")).toBe(1);
    });

    it("lets through a given locale, sorting, the time zone read, and comments", () => {
        expect(countBrowserLocaleDates("d.toLocaleDateString(locale, { month: 'short' })")).toBe(
            0
        );
        expect(countBrowserLocaleDates("d.toLocaleString('en-CA')")).toBe(0);
        expect(
            countBrowserLocaleDates("a.localeCompare(b, undefined, { sensitivity: 'base' })")
        ).toBe(0);
        expect(countBrowserLocaleDates("Intl.DateTimeFormat().resolvedOptions().timeZone")).toBe(
            0
        );
        expect(countBrowserLocaleDates("new Intl.DateTimeFormat(locale, o).format(d)")).toBe(0);
        expect(countBrowserLocaleDates("// d.toLocaleDateString(undefined)")).toBe(0);
        expect(countBrowserLocaleDates("/* d.toLocaleString() */")).toBe(0);
        expect(countBrowserLocaleDates("new ctor(undefined, { granularity: 'grapheme' })")).toBe(
            0
        );
    });
});
