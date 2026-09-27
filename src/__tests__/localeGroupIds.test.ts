/**
 * The demo guide's Spotlight cards, across all seven locales.
 *
 * Two distinct bugs are pinned here, both invisible to `tsc` and both
 * user-visible on `/demo-guide` — the page whose entire job is a first
 * impression. `DeepPartial<Messages>` widens string literals on purpose
 * (`src/i18n/types.ts`), so translators can fill keys incrementally; the
 * cost is that a translated value the CODE depends on type-checks fine.
 *
 * 1. `id` was a lookup key. `DemoPage` used to pick each card's icon with
 *    `GROUP_ICONS[groupItem.id]`, so translating `id` silently dropped the
 *    icon to a generic fallback: ja/ar/hi resolved 0 of 7, es/fr 1 of 7 by
 *    luck, and only zh (which kept the English ids) was correct. The page
 *    now indexes by POSITION, so these assertions guard the remaining
 *    contract — that every locale keeps the canonical ids, in order, and
 *    the same number of groups as the icon table has entries.
 *
 * 2. The first group's prompts are LITERAL SEARCH KEYWORDS, not prose.
 *    They are typed into Spotlight verbatim, so they have to match the
 *    seeded workspace. Machine translation had turned `framer-motion` into
 *    フレーマーモーション / movimiento-enmarcador / 成帧器运动, the product
 *    `Plausible` into the adjective "plausible", and — in hi — the shortcut
 *    `Cmd-K` into `Cmd-कश्मीर` ("Kashmir"). None of those match anything:
 *    the seeder keeps proper nouns and shortcuts in Latin in the Japanese
 *    table too, and `DEMO_LANGUAGES = ("en", "ja")` means es/fr/zh/ar/hi
 *    visitors get an ENGLISH workspace, so a localised keyword cannot
 *    match by construction. Worse than empty: against the JA index the
 *    katakana form returns MORE hits than the Latin one (61 vs 27) because
 *    kuromoji shreds it into fragments, all of them irrelevant — the
 *    visitor gets confident-looking results for something they didn't ask.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { GROUP_ORDER } from "../lp/DemoPage";

// Imported directly rather than through `localeLoaders`, which is async by
// design. The property under test is a property of the source catalogs.
const LOCALES = { en, ja, es, fr, ar, hi, zh } as const;

type GroupLike = { id?: string; prompts?: readonly string[] };

const groupsOf = (name: keyof typeof LOCALES): readonly GroupLike[] =>
    ((LOCALES[name] as { demoPage?: { spotlight?: { groups?: readonly GroupLike[] } } }).demoPage
        ?.spotlight?.groups ?? []) as readonly GroupLike[];

const NAMES = Object.keys(LOCALES) as Array<keyof typeof LOCALES>;

describe("demo guide group ids", () => {
    it.each(NAMES)("%s uses the canonical ids in canonical order", (name) => {
        const ids = groupsOf(name).map((g) => g.id);
        // Compared as a whole array, and with the locale in the payload, so
        // a failure names the locale and shows exactly which id drifted.
        expect({ locale: name, ids }).toEqual({ locale: name, ids: [...GROUP_ORDER] });
    });

    it.each(NAMES)("%s has one group per icon", (name) => {
        expect({ locale: name, count: groupsOf(name).length }).toEqual({
            locale: name,
            count: GROUP_ORDER.length,
        });
    });
});

describe("demo guide search keywords", () => {
    /**
     * `synthesis` has no Japanese surface form in the seeded content (it
     * survives only as the dict key `task_synthesis`), so the JA prompt
     * points at the 顧客インタビュー analysis task instead — the equivalent
     * entry point, and a real string in that workspace. Every other locale
     * is seeded the English table, so it must use the English tokens.
     */
    const EXPECTED: Record<keyof typeof LOCALES, readonly string[]> = {
        en: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
        ja: ["framer-motion", "Plausible", "顧客インタビュー", "Cmd-K"],
        es: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
        fr: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
        ar: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
        hi: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
        zh: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
    };

    it.each(NAMES)("%s keeps the keyword prompts matchable", (name) => {
        const prompts = groupsOf(name)[0]?.prompts ?? [];
        expect({ locale: name, prompts: [...prompts] }).toEqual({
            locale: name,
            prompts: [...EXPECTED[name]],
        });
    });

    it.each(NAMES)("%s never transliterates the product name", (name) => {
        // The forms machine translation actually produced. Asserted across
        // the whole demoPage section, not just the keyword group, because
        // the prose referenced the product too ("¿Por qué descartamos el
        // movimiento del marco?").
        const BAD = [
            "フレーマーモーション",
            "movimiento-enmarcador",
            "movimiento del marco",
            "movimiento del encuadre",
            "成帧器运动",
            "حركة الإطار",
            "फ़्रेमर-मोशन",
            "Cmd-कश्मीर",
            "Comando-K",
            "كمد-K",
        ];
        const blob = JSON.stringify((LOCALES[name] as { demoPage?: unknown }).demoPage ?? {});
        const found = BAD.filter((bad) => blob.includes(bad));
        expect({ locale: name, found }).toEqual({ locale: name, found: [] });
    });
});
