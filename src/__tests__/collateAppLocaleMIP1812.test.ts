// @vitest-environment node
/**
 * MIP-1812: names are sorted in the app's language, never the browser's.
 *
 * `a.localeCompare(b)` and `a.localeCompare(b, undefined, ...)` use the BROWSER's
 * collation. Use `compareText` from `src/i18n/collate` (pass `locale` from
 * `useTranslation()` in a component). A new bare `localeCompare` in `src` fails the guard:
 * use the helper, or, if the site must stay locale-independent (ISO timestamps, ids), add
 * the file to ALLOWED with the reason.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { Locale } from "../i18n";
import { compareText, getCollator } from "../i18n/collate";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** file (relative to src) -> the most `localeCompare` calls it may hold, and why. */
const ALLOWED: Record<string, { max: number; why: string }> = {
    "i18n/collate.ts": { max: 0, why: "the helper itself uses Intl.Collator" },
    "devtools/blocknoteCompat/cli.ts": { max: 1, why: "dev CLI listing file names, no UI" },
    "features/tasks/services/loadTaskVelocity.ts": { max: 1, why: "ISO date strings" },
    "features/calendar/utils/multiDay.ts": { max: 1, why: "event ids, a stable tie-break" },
    "features/chat/hooks/useWarmRecentChannels.ts": { max: 1, why: "ISO timestamps" },
    "features/channel/hooks/useChannelList.ts": { max: 1, why: "ISO timestamps" },
    "features/chat/adapters/v3ToLegacy.ts": { max: 8, why: "ISO timestamps (tsSent)" },
    "hooks/tasks/useSprintMilestoneManagement.ts": { max: 1, why: "ISO start dates" },
    "components/modals/views/ModalTodoView.tsx": { max: 1, why: "ISO local dates" },
    "features/notes/common/utils/filterNotes.ts": {
        max: 1,
        why: "ISO tsUpdated (title uses compareText)",
    },
    "lp/blog/blog.ts": {
        max: 1,
        why: "marketing blog tie-break outside the app locale provider, same-day articles only",
    },
    "utils/userTimezone.ts": {
        max: 1,
        why: "IANA city names are English text, listed in English order",
    },
};

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

const count = (text: string): number =>
    stripComments(text).match(/\.localeCompare\(/g)?.length ?? 0;

describe("names sort in the app's language (guard)", () => {
    const found: Record<string, number> = {};
    for (const file of walk(SRC)) {
        const n = count(fs.readFileSync(file, "utf8"));
        if (n > 0) found[path.relative(SRC, file).split(path.sep).join("/")] = n;
    }

    it("no file outside the allowed list calls localeCompare", () => {
        const unknown = Object.keys(found).filter((f) => !(f in ALLOWED));
        expect(
            unknown,
            `localeCompare in ${unknown.join(", ")}: use compareText from i18n/collate, or add the file to ALLOWED in collateAppLocaleMIP1812.test.ts with a reason.`
        ).toEqual([]);
    });

    it("an allowed file does not hold more than it may", () => {
        for (const [file, { max, why }] of Object.entries(ALLOWED)) {
            expect(found[file] ?? 0, `${file}: ${why}`).toBeLessThanOrEqual(max);
        }
    });

    it("counts a call, ignores comments", () => {
        expect(count("a.localeCompare(b)")).toBe(1);
        expect(count("a.localeCompare(b, undefined, {})")).toBe(1);
        expect(count("// a.localeCompare(b)")).toBe(0);
    });
});

const sorted = (names: string[], locale: Locale, sensitivity?: "base" | "variant") =>
    [...names].sort((a, b) => compareText(a, b, { locale, sensitivity }));

describe("compareText per locale", () => {
    it("en: same order as the old bare localeCompare on an English browser", () => {
        const names = ["banana", "Apple", "apple", "Éclair", "eclair", "item 10", "item 2", "Zed"];
        expect(sorted(names, "en")).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
        // not numeric, as before
        expect(sorted(["item 10", "item 2"], "en")).toEqual(["item 10", "item 2"]);
    });

    it("en: base sensitivity ties case and accents (stable)", () => {
        expect(compareText("a", "A", { locale: "en", sensitivity: "base" })).toBe(0);
        expect(compareText("e", "é", { locale: "en", sensitivity: "base" })).toBe(0);
        expect(compareText("a", "A", { locale: "en" })).not.toBe(0);
    });

    it("ja: kana in gojuon order", () => {
        expect(sorted(["う", "あ", "か", "い", "え"], "ja")).toEqual([
            "あ",
            "い",
            "う",
            "え",
            "か",
        ]);
        // hiragana and katakana of the same sound compare equal at base, a before ka
        expect(sorted(["カ", "ア", "サ"], "ja")).toEqual(["ア", "カ", "サ"]);
    });

    it("zh: pinyin order", () => {
        expect(sorted(["张", "王", "李", "陈"], "zh")).toEqual(["陈", "李", "王", "张"]);
    });

    it("es: ñ after n, before o", () => {
        expect(sorted(["oso", "ñu", "nube", "zorro"], "es")).toEqual([
            "nube",
            "ñu",
            "oso",
            "zorro",
        ]);
        // Swedish-style rules would not do this: the locale matters
        expect(compareText("ñu", "oso", { locale: "es" })).toBeLessThan(0);
    });

    it("fr: accents are a tie-break, not a letter", () => {
        expect(sorted(["côte", "cote", "coté", "côté"], "fr").slice(0, 1)).toEqual(["cote"]);
        expect(compareText("é", "f", { locale: "fr" })).toBeLessThan(0);
    });

    it("ar and hi: their own alphabets in order", () => {
        expect(sorted(["ج", "ب", "ا"], "ar")).toEqual(["ا", "ب", "ج"]);
        expect(sorted(["ग", "क", "अ", "ख"], "hi")).toEqual(["अ", "क", "ख", "ग"]);
    });

    it("kana and Latin differ between ja and en rules only where they should", () => {
        // Japanese and English agree on plain ASCII
        expect(sorted(["b", "a", "C"], "ja")).toEqual(sorted(["b", "a", "C"], "en"));
    });

    it("caches one collator per locale and sensitivity", () => {
        expect(getCollator("ja")).toBe(getCollator("ja"));
        expect(getCollator("ja")).not.toBe(getCollator("en"));
        expect(getCollator("ja", "base")).not.toBe(getCollator("ja"));
    });

    it("without a locale it reads the document's, then the stored/browser choice", () => {
        expect(compareText("a", "b")).toBeLessThan(0);
    });
});
