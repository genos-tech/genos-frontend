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
 * What the runtime formatter (`fmt` in i18n/interpolate.ts) understands, copied so a
 * translation that would render as raw ICU text fails here: a plural is exactly
 * `{name, plural, one {..} other {..}}` with no nesting inside a branch.
 */
const PLURAL = /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g;

/** The arguments of a message: plural counts and plain `{name}`s (a set: a translation may repeat or drop a repeat). */
/** What is left of a message once its readable plurals are cut out (`split` with the three
 *  capture groups returns text, key, one, other, text, ...: every fourth piece is text). */
const outsidePlurals = (s: string): string =>
    s
        .split(PLURAL)
        .filter((_, i) => i % 4 === 0)
        .join("");

const placeholders = (s: string): string[] => {
    const names = new Set<string>();
    for (const m of s.matchAll(PLURAL)) names.add(m[1]);
    for (const m of outsidePlurals(s).matchAll(/\{(\w+)\}/g)) names.add(m[1]);
    return [...names].sort();
};

/** Plurals the formatter cannot read (zero/two/few/many forms, nesting, a stray brace). */
const unreadablePlural = (s: string): boolean => /plural\s*,/.test(outsidePlurals(s));

/** Plural keys whose branches carry `#` (the number) in English: a translation must keep it in `other` (`one` may spell the singular out, as Arabic does). */
const hashKeys = (s: string): string[] =>
    [...s.matchAll(PLURAL)]
        .filter((m) => m[2].includes("#") || m[3].includes("#"))
        .map((m) => m[1]);
const dropsHash = (en: string, tr: string): string[] => {
    const keep = new Set(hashKeys(en));
    return [...tr.matchAll(PLURAL)]
        .filter((m) => keep.has(m[1]) && !m[3].includes("#"))
        .map((m) => m[1]);
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
    /\b(Genos AI|Genos|GitHub|Google Calendar|Google Gemini|Google|Anthropic Claude|OpenAI GPT|MCP|GIF|MDM|Spotlight AI|Spotlight|Ctrl|Cmd|Alt)\b/g;
const isOnlyTokens = (en: string) =>
    !/[A-Za-z]{3,}/.test(en.replace(/\{[^}]*\}/g, "").replace(BRAND, ""));

/** Rule 2: the explicit list. */
const ARABIC_SAME_AS_ENGLISH_OK: Record<string, string> = {
    "settings.language.english": "a language is named in its own language",
    "settings.language.spanish": "a language is named in its own language",
    "settings.language.french": "a language is named in its own language",
    "settings.connectedApps.connect.claudeCodeTitle": "the product name Claude Code",
    "settings.connectedApps.connect.chatgptTitle": "the product name ChatGPT",
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

        it(`${name}: every plural is one/other, and keeps its # where English has one`, () => {
            const bad = TRANSLATABLE.filter(
                (k) => k in L && (unreadablePlural(L[k]) || dropsHash(EN[k], L[k]).length > 0)
            );
            expect(bad, `${name} has a plural the formatter cannot render`).toEqual([]);
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
