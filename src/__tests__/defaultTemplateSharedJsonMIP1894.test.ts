/**
 * MIP-1894: the default template's words in every language are READ from the vendored shared
 * JSON, the file genos-api pins and recognises its prompts from, so a task quick-created in ja is
 * saved with hints the api knows.
 */
import { describe, expect, it } from "vitest";

import shared from "../features/tasks/utils/builtinTaskTemplates.json";
import {
    DEFAULT_TEMPLATE_ORDER,
    DEFAULT_TEMPLATE_TEXT,
} from "../features/tasks/utils/defaultTemplateText";
import type { Locale } from "../i18n/types";

const LOCALES = Object.keys(DEFAULT_TEMPLATE_TEXT) as Locale[];
const def = shared.templates.find((t) => t.id === "default")!;

// every string the api would treat as a prompt (`PROMPT_TEXTS`): each item's text and translations
const apiPrompts = new Set<string>(
    def.sections.flatMap((s) =>
        s.items.flatMap((i) => [
            i.text,
            ...Object.values((i as { i18n?: Record<string, string> }).i18n ?? {}),
        ])
    )
);

describe("DEFAULT_TEMPLATE_TEXT comes from the shared JSON", () => {
    it("covers the seven locales", () => {
        expect(LOCALES.sort()).toEqual(["ar", "en", "es", "fr", "hi", "ja", "zh"]);
    });

    it.each(LOCALES)("%s: every hint line is a prompt the api recognises", (loc) => {
        for (const keys of DEFAULT_TEMPLATE_ORDER) {
            for (const key of keys.slice(1)) {
                expect(apiPrompts.has(DEFAULT_TEMPLATE_TEXT[loc][key]), `${loc}.${key}`).toBe(
                    true
                );
            }
        }
    });

    it("every translation in the JSON is used, none is left over", () => {
        const used = new Set(
            LOCALES.flatMap((loc) =>
                DEFAULT_TEMPLATE_ORDER.flatMap((keys) =>
                    keys.slice(1).map((k) => DEFAULT_TEMPLATE_TEXT[loc][k])
                )
            )
        );
        expect([...apiPrompts].filter((p) => !used.has(p))).toEqual([]);
    });

    it("the JSON carries every locale for every heading and line", () => {
        for (const s of def.sections) {
            const h = (s as { heading_i18n?: Record<string, string> }).heading_i18n ?? {};
            expect(Object.keys(h).sort()).toEqual(["ar", "es", "fr", "hi", "ja", "zh"]);
            for (const i of s.items) {
                const t = (i as { i18n?: Record<string, string> }).i18n ?? {};
                expect(Object.keys(t).sort()).toEqual(["ar", "es", "fr", "hi", "ja", "zh"]);
            }
        }
    });
});
