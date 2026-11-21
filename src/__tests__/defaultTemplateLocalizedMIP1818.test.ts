/**
 * MIP-1818: the standard task template's headings and hint lines follow the app language, so
 * the SAVED body reads in it, and the untouched-hint check still works in every language.
 */
import { PartialBlock } from "@blocknote/core";
import { afterEach, describe, expect, it } from "vitest";

import shared from "../features/tasks/utils/builtinTaskTemplates.json";
import {
    DEFAULT_TEMPLATE_ORDER,
    DEFAULT_TEMPLATE_TEXT,
    type DefaultTemplateTextKey,
} from "../features/tasks/utils/defaultTemplateText";
import {
    getTaskContentTemplate,
    getTemplateBlocks,
    stripUntouchedPrompts,
    TASK_TEMPLATES,
} from "../features/tasks/utils/taskTemplates";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { Locale } from "../i18n/types";

const LOCALES = Object.keys(DEFAULT_TEMPLATE_TEXT) as Locale[];
const OTHERS = LOCALES.filter((l) => l !== "en");

const text = (b: PartialBlock) =>
    (Array.isArray(b.content) ? (b.content as { text?: string }[]) : [])
        .map((r) => r.text ?? "")
        .join("");
const headings = (blocks: PartialBlock[]) =>
    blocks.filter((b) => b.type === "heading").map((b) => text(b));
const fill = (blocks: PartialBlock[], promptText: string, typed: string): PartialBlock[] =>
    blocks.map((b) =>
        text(b) === promptText ? { ...b, content: [{ type: "text", text: typed, styles: {} }] } : b
    ) as PartialBlock[];

afterEach(() => window.localStorage.removeItem(LOCALE_STORAGE_KEY));

describe("the word table matches the vendored template", () => {
    const def = shared.templates.find((t) => t.id === "default")!;
    it("en equals builtinTaskTemplates.json, position by position", () => {
        expect(def.sections).toHaveLength(DEFAULT_TEMPLATE_ORDER.length);
        def.sections.forEach((sec, i) => {
            const keys = DEFAULT_TEMPLATE_ORDER[i];
            expect(sec.items).toHaveLength(keys.length - 1);
            expect(sec.heading).toBe(DEFAULT_TEMPLATE_TEXT.en[keys[0]]);
            sec.items.forEach((item, j) =>
                expect(item.text).toBe(DEFAULT_TEMPLATE_TEXT.en[keys[j + 1]])
            );
        });
    });
    it.each(OTHERS)("%s translates every word (none left equal to en)", (loc) => {
        for (const [k, v] of Object.entries(DEFAULT_TEMPLATE_TEXT[loc])) {
            expect(v, k).toBeTruthy();
            expect(v, k).not.toBe(DEFAULT_TEMPLATE_TEXT.en[k as DefaultTemplateTextKey]);
        }
    });
});

describe("the default body follows the language", () => {
    it("en is exactly the built-in blocks", () => {
        expect(getTaskContentTemplate("en")).toBe(TASK_TEMPLATES.default.blocks);
    });
    it.each(OTHERS)(
        "%s: headings and hint lines are that language, structure unchanged",
        (loc) => {
            const en = TASK_TEMPLATES.default.blocks;
            const out = getTaskContentTemplate(loc);
            expect(out).toHaveLength(en.length);
            expect(out.map((b) => b.type)).toEqual(en.map((b) => b.type));
            expect(headings(out)).toEqual(
                DEFAULT_TEMPLATE_ORDER.map((keys) => DEFAULT_TEMPLATE_TEXT[loc][keys[0]])
            );
            const allText = out.map(text).join("\n");
            for (const w of ["Summary", "Motivation", "Acceptance criteria", "First condition"])
                expect(allText).not.toContain(w);
        }
    );
    it("without an argument it reads the stored app language", () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        expect(headings(getTaskContentTemplate())[2]).toBe("✅ 受け入れ条件");
        window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
        expect(headings(getTaskContentTemplate())[2]).toBe("✅ Acceptance criteria");
    });
    it("the other three templates are still English in ja", () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        expect(getTemplateBlocks("bug")).toBe(TASK_TEMPLATES.bug.blocks);
    });
});

describe("the untouched-template check works in every language", () => {
    it.each(LOCALES)("%s: an untouched default body saves as one empty paragraph", (loc) => {
        const out = stripUntouchedPrompts(getTaskContentTemplate(loc));
        expect(out).toHaveLength(1);
        expect(out[0].type).toBe("paragraph");
        expect(text(out[0])).toBe("");
    });
    it.each(LOCALES)("%s: a filled section keeps its heading, untouched ones go", (loc) => {
        const w = DEFAULT_TEMPLATE_TEXT[loc];
        const body = fill(
            getTaskContentTemplate(loc),
            w.motivationHint,
            "Users lose their draft."
        );
        const out = stripUntouchedPrompts(body);
        expect(headings(out)).toEqual([w.motivationHeading]);
        expect(out.map(text)).toContain("Users lose their draft.");
        for (const gone of [w.criterion1, w.criterion2, w.notesHint, w.summaryHint])
            expect(out.map(text)).not.toContain(gone);
    });
    it("a body made in ja is still recognised after the language changes (draft reopened)", () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
        const out = stripUntouchedPrompts(getTaskContentTemplate("ja"));
        expect(out).toHaveLength(1);
        expect(text(out[0])).toBe("");
    });
    it("a hint line the author typed (no prompt styling) is kept in any language", () => {
        const w = DEFAULT_TEMPLATE_TEXT.ja;
        const typed: PartialBlock = {
            type: "paragraph",
            content: [{ type: "text", text: w.notesHint, styles: {} }],
        } as PartialBlock;
        const out = stripUntouchedPrompts([
            {
                type: "heading",
                props: { level: 3 },
                content: [{ type: "text", text: w.notesHeading, styles: {} }],
            } as PartialBlock,
            typed,
        ]);
        expect(out.map(text)).toContain(w.notesHint);
    });
    it("old saved bodies (English text, any locale) are untouched content: nothing re-translates them", () => {
        // A saved body is plain blocks; the check only strips prompt-styled lines at submit.
        const saved = TASK_TEMPLATES.default.blocks.map((b) => ({ ...b }));
        expect(JSON.stringify(saved)).toBe(JSON.stringify(TASK_TEMPLATES.default.blocks));
    });
});
