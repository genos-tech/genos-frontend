/**
 * MIP-1179: the WHOLE catalog is translated in every locale.
 *
 * `DeepPartial<Messages>` lets a locale omit a key and quietly show English, so a missing
 * key never fails the build. This reads the RAW catalogs and compares every leaf of `en`
 * (not just `tasks.*`, see tasksLocaleCoverage.test.tsx) with each of the six others:
 *
 *   1. every leaf of `en` exists and is not blank,
 *   2. it keeps the same `{placeholders}`,
 *   3. a locale has no leaf that English lacks (a dead key nothing can read),
 *   4. Arabic is not English copied under an Arabic key.
 *
 * A non-Arabic locale MAY equal English (Japanese keeps "To-Do", French "Backlog"...), so
 * (4) is Arabic-only, with a short explicit exemption list.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, zh, es, fr, hi, ar } as const;

/** Every string leaf as `dotted.path -> value`. Array items are `path.0`, `path.1`. */
const leaves = (node: unknown, prefix = "", out: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries((node ?? {}) as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") leaves(v, path, out);
        // A flag such as `headline: true` is not text: it has nothing to translate.
        else if (typeof v === "string") out[path] = v;
    }
    return out;
};

/**
 * The argument names of an ICU message: `{name}` and `{count, plural, ...}`, including the
 * ones nested inside a branch. The words of a branch body (`one {# day}`) are text, so a
 * translation may reword them freely.
 */
const placeholders = (s: string): string[] => {
    const names = new Set<string>();
    const body = (i: number, inBranch: boolean): number => {
        while (i < s.length) {
            if (s[i] === "{") i = argument(i + 1);
            else if (s[i] === "}" && inBranch) return i;
            else i++;
        }
        return i;
    };
    const argument = (start: number): number => {
        let j = start;
        while (j < s.length && s[j] !== "}" && s[j] !== ",") j++;
        names.add(s.slice(start, j).trim());
        if (s[j] === "}") return j + 1;
        let k = j + 1;
        while (k < s.length && s[k] !== "," && s[k] !== "}") k++;
        const kind = s.slice(j + 1, k).trim();
        if (s[k] === "}") return k + 1;
        k++;
        if (!/^(plural|select|selectordinal)$/.test(kind)) {
            while (k < s.length && s[k] !== "}") k++;
            return k + 1;
        }
        while (k < s.length) {
            while (/\s/.test(s[k] ?? "")) k++;
            if (s[k] === "}") return k + 1;
            while (k < s.length && s[k] !== "{" && s[k] !== "}") k++; // the selector: one, other, =0
            if (s[k] !== "{") return k + 1;
            k = body(k + 1, true) + 1;
        }
        return k;
    };
    body(0, false);
    return [...names].sort();
};

const EN = leaves(en);
/** English leaves that are blank on purpose (nothing to translate). */
const BLANK_IN_EN = new Set(Object.keys(EN).filter((k) => EN[k].trim() === ""));
const TRANSLATABLE = Object.keys(EN).filter((k) => !BLANK_IN_EN.has(k));

/**
 * Arabic text that is legitimately identical to English. Two rules plus a short explicit list
 * (a new entry needs a reason a translator could not do better).
 *
 * Rule 1: once `{placeholders}` and brand/format tokens are removed, no word is left (a
 * string like `{subtitle}{sep}`, `GitHub`, `Genos AI`, `Ctrl+⌘+O`).
 */
const BRAND =
    /\b(Genos|GitHub|Google|Calendar|Gemini|Anthropic|Claude|OpenAI|GPT|MCP|GIF|MDM|Spotlight|AI|Ctrl|Cmd|Alt)\b/g;
const isOnlyTokens = (en: string) =>
    !/[A-Za-z]{3,}/.test(en.replace(/\{[^}]*\}/g, "").replace(BRAND, ""));

/** Rule 2: the explicit list. */
const ARABIC_SAME_AS_ENGLISH_OK: Record<string, string> = {
    "settings.language.english": "a language is named in its own language",
    "settings.language.spanish": "a language is named in its own language",
    "settings.language.french": "a language is named in its own language",
    "common.editor.emojiTypingHint": "the literal `:+typing` trigger the user types",
    "settings.developer.webhooks.urlPlaceholder": "an example URL",
    "tasks.linkedPr.paste": "an example URL",
    "admin.inviteMembers.emailPlaceholder": "an example e-mail address",
    "integrations.github.webhook.contentTypeLabel": "GitHub's own `application/json` option",
    "integrations.github.webhook.eventSelectionLabel": "quotes GitHub's English radio label",
    "integrations.connections.verificationError": "Google's literal error text",
    "chat.headers.quickMeetEventTitle": "the Quick Meet feature name",
    "demoPage.spotlight.groups.0.prompts.0": "demo search keyword: a library name",
    "demoPage.spotlight.groups.0.prompts.1": "demo search keyword: a product name",
    "demoPage.spotlight.groups.0.prompts.2": "demo search keyword shown verbatim",
    "demoPage.spotlight.groups.0.prompts.3": "demo search keyword: the Cmd-K shortcut",
};
/** Rule 3: ids, not text. */
const isCodeId = (k: string) => /^demoPage\.spotlight\.groups\.\d+\.id$/.test(k);

const CATALOGS = Object.entries(OTHERS).map(([name, catalog]) => [name, leaves(catalog)] as const);

describe("whole catalog: every locale has every English key", () => {
    it("English itself has leaves (the comparison is not vacuous)", () => {
        expect(TRANSLATABLE.length).toBeGreaterThan(2000);
    });

    for (const [name, L] of CATALOGS) {
        it(`${name} is missing no key`, () => {
            const missing = TRANSLATABLE.filter((k) => !(k in L) || L[k].trim() === "");
            expect(missing, `${name} lacks ${missing.length} keys`).toEqual([]);
        });

        it(`${name} keeps the same {placeholders} as English`, () => {
            const bad = TRANSLATABLE.filter(
                (k) => k in L && placeholders(L[k]).join() !== placeholders(EN[k]).join()
            ).map((k) => `${k}: en {${placeholders(EN[k])}} vs ${name} {${placeholders(L[k])}}`);
            expect(bad, `${name} changed placeholders`).toEqual([]);
        });

        it(`${name} has no key that English lacks`, () => {
            const extra = Object.keys(L).filter((k) => !(k in EN));
            expect(extra, `${name} has ${extra.length} keys English lacks`).toEqual([]);
        });
    }

    it("Arabic is translated, not English copied under an Arabic key", () => {
        const L = Object.fromEntries(CATALOGS).ar;
        const english = TRANSLATABLE.filter(
            (k) =>
                L[k] === EN[k] &&
                /[A-Za-z]{3,}/.test(EN[k]) &&
                !isOnlyTokens(EN[k]) &&
                !isCodeId(k) &&
                !(k in ARABIC_SAME_AS_ENGLISH_OK)
        );
        expect(english, "ar copies English text").toEqual([]);
    });

    it("every Arabic exemption still names a key that equals English (the list stays honest)", () => {
        const L = Object.fromEntries(CATALOGS).ar;
        for (const k of Object.keys(ARABIC_SAME_AS_ENGLISH_OK)) {
            expect(L[k], `${k} no longer equals English: drop it from the list`).toBe(EN[k]);
        }
    });
});
