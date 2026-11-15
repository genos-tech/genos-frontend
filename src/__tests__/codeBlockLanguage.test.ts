/**
 * MIP-1601: importing a .md file with a ```ts fence left the note with only its title and
 * `Uncaught (in promise) Error: Language ts is not supported.` in the console. The markdown
 * parser keeps the fence name as the block's language; BlockNote's code block only knows
 * its `supportedLanguages` ids (`typescript`, not the alias `ts`) and throws while the node
 * view renders, so the editor never shows the body. These tests run the real import, the real
 * Yjs writer and real mounted editors.
 */
import { codeBlockOptions } from "@blocknote/code-block";
import { BlockNoteEditor, BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
    EXTRA_CODE_LANGUAGE_ALIASES,
    normalizeCodeBlockLanguages,
    resolveCodeLanguage,
    SUPPORTED_CODE_LANGUAGE_IDS,
} from "../components/editors/codeBlockLanguage";
import { genosBaseBlockSpecs } from "../components/editors/genos/genosSchemaParts";
import { genosStyleSpecs } from "../components/editors/genosStyleSpecs";
import { applyBlocksToFragment } from "../features/notes/common/services/applyNoteBodyToYjs";
import { markdownToNoteBlocks } from "../features/notes/common/services/noteMarkdown";

type AnyEditor = BlockNoteEditor<any, any, any>;

const mount = (initialContent: unknown): AnyEditor => {
    const schema = BlockNoteSchema.create({
        styleSpecs: genosStyleSpecs,
        inlineContentSpecs: defaultInlineContentSpecs,
        blockSpecs: genosBaseBlockSpecs(),
    } as never);
    const editor = BlockNoteEditor.create({ schema, initialContent } as never) as AnyEditor;
    editor.mount(document.body.appendChild(document.createElement("div")));
    return editor;
};

const code = (b: any): string => (b.content ?? []).map((c: any) => c.text).join("");

describe("resolveCodeLanguage", () => {
    it("maps aliases to the ids the editor has", () => {
        expect(resolveCodeLanguage("ts")).toBe("typescript");
        expect(resolveCodeLanguage("TS")).toBe("typescript");
        expect(resolveCodeLanguage("js")).toBe("javascript");
        expect(resolveCodeLanguage("bash")).toBe("shellscript");
        expect(resolveCodeLanguage("sh")).toBe("shellscript");
        expect(resolveCodeLanguage("yml")).toBe("yaml");
        expect(resolveCodeLanguage("md")).toBe("markdown");
        expect(resolveCodeLanguage("py")).toBe("python");
        expect(resolveCodeLanguage("tsx")).toBe("tsx");
        expect(resolveCodeLanguage("jsx")).toBe("jsx");
        expect(resolveCodeLanguage("json")).toBe("json");
        expect(resolveCodeLanguage("node")).toBe("javascript");
    });

    it("lets a fence info string through and falls back to plain text for the rest", () => {
        expect(resolveCodeLanguage('ts title="a.ts"')).toBe("typescript");
        expect(resolveCodeLanguage("js {1,3}")).toBe("javascript");
        expect(resolveCodeLanguage("klingon")).toBe("text");
        expect(resolveCodeLanguage("go")).toBe("text");
        expect(resolveCodeLanguage("")).toBe("text");
        expect(resolveCodeLanguage(undefined)).toBe("text");
        expect(resolveCodeLanguage(42)).toBe("text");
        expect(resolveCodeLanguage("__proto__")).toBe("text");
        expect(resolveCodeLanguage("constructor")).toBe("text");
    });

    it("every id passes through and every alias it can return is supported", () => {
        for (const id of SUPPORTED_CODE_LANGUAGE_IDS) expect(resolveCodeLanguage(id)).toBe(id);
        const supported = new Set(SUPPORTED_CODE_LANGUAGE_IDS);
        for (const [alias, target] of Object.entries(EXTRA_CODE_LANGUAGE_ALIASES)) {
            expect(supported.has(target), `${alias} -> ${target}`).toBe(true);
            expect(supported.has(resolveCodeLanguage(alias)), alias).toBe(true);
        }
        for (const [id, { aliases }] of Object.entries(
            codeBlockOptions.supportedLanguages ?? {}
        )) {
            for (const alias of aliases ?? []) {
                expect(supported.has(resolveCodeLanguage(alias)), `${id}: ${alias}`).toBe(true);
            }
        }
    });
});

describe("normalizeCodeBlockLanguages", () => {
    it("rewrites nested code blocks, keeps the code, and keeps a clean body by reference", () => {
        const clean = [{ type: "codeBlock", props: { language: "typescript" }, content: [] }];
        expect(normalizeCodeBlockLanguages(clean)).toBe(clean);
        const blocks = [
            {
                type: "bulletListItem",
                children: [
                    {
                        type: "codeBlock",
                        props: { language: "ts" },
                        content: [{ type: "text", text: "let a = 1;", styles: {} }],
                    },
                ],
            },
        ];
        const out = normalizeCodeBlockLanguages(blocks) as any[];
        expect(out[0].children[0].props.language).toBe("typescript");
        expect(code(out[0].children[0])).toBe("let a = 1;");
        expect(blocks[0].children[0].props.language).toBe("ts");
    });
});

const MD = [
    "# Notes",
    "",
    "```ts",
    "const a: number = 1;",
    "```",
    "",
    "text between",
    "",
    "```js",
    "console.log('x');",
    "```",
    "",
    "```bash",
    "echo $HOME",
    "```",
    "",
    "```yaml",
    "a: 1",
    "```",
    "",
    "```klingon",
    "Qapla'",
    "```",
    "",
    "```",
    "no language",
    "```",
    "",
].join("\n");

describe("markdown import", () => {
    it("keeps every fenced body, maps the language and falls back to plain text", async () => {
        const blocks = await markdownToNoteBlocks(MD);
        const fences = blocks.filter((b) => b.type === "codeBlock");
        expect(fences.map((b) => (b.props as any).language)).toEqual([
            "typescript",
            "javascript",
            "shellscript",
            "yaml",
            "text",
            "text",
        ]);
        expect(fences.map(code)).toEqual([
            "const a: number = 1;",
            "console.log('x');",
            "echo $HOME",
            "a: 1",
            "Qapla'",
            "no language",
        ]);
        expect(blocks.some((b) => b.type === "heading")).toBe(true);
        expect(blocks.some((b) => b.type === "paragraph")).toBe(true);
    });

    it("still reads a math / mermaid fence as its own block", async () => {
        const blocks = await markdownToNoteBlocks(
            "```mermaid\ngraph TD; A-->B\n```\n\n```math\nx^2\n```"
        );
        expect(blocks.map((b) => b.type)).toEqual(["diagram", "mathBlock"]);
    });

    it("imported blocks mount in a real editor with every body intact", async () => {
        const editor = mount(await markdownToNoteBlocks(MD));
        expect(editor.document.filter((b: any) => b.type === "codeBlock")).toHaveLength(6);
        expect(editor.document.map((b: any) => b.type)).toContain("heading");
    });
});

describe("a language the editor has no id for, already stored", () => {
    it("renders a stored `ts`, `klingon` and non-string block instead of throwing", () => {
        const stored = [
            { type: "paragraph", content: "before" },
            {
                type: "codeBlock",
                props: { language: "ts" },
                content: [{ type: "text", text: "let x = 1;", styles: {} }],
            },
            {
                type: "codeBlock",
                props: { language: "klingon" },
                content: [{ type: "text", text: "Qapla'", styles: {} }],
            },
            { type: "paragraph", content: "after" },
        ];
        const editor = mount(stored);
        expect(editor.document).toHaveLength(4);
        expect(code(editor.document[1])).toBe("let x = 1;");
        expect(code(editor.document[2])).toBe("Qapla'");
        const selects = [...document.querySelectorAll("select")].map((s) => s.value);
        expect(selects).toContain("typescript");
        expect(selects).toContain("text");
    });
});

describe("pasting HTML code", () => {
    it("reads `language-ts` as typescript and an unknown name as plain text, keeping the code", async () => {
        const editor = mount([{ type: "paragraph", content: "" }]);
        const blocks = await editor.tryParseHTMLToBlocks(
            '<pre><code class="language-ts">let a = 1;</code></pre>' +
                '<pre><code class="language-klingon">Qapla</code></pre>'
        );
        const fences = blocks.filter((b: any) => b.type === "codeBlock");
        expect(fences.map((b: any) => b.props.language)).toEqual(["typescript", "text"]);
        expect(fences.map(code)).toEqual(["let a = 1;", "Qapla"]);
    });
});

describe("applyBlocksToFragment (api / agent written bodies)", () => {
    it("writes a body with `ts` and an unknown language with the languages resolved", () => {
        const doc = new Y.Doc();
        const fragment = doc.getXmlFragment("document-store");
        applyBlocksToFragment(
            [
                { type: "codeBlock", props: { language: "ts" }, content: "a" },
                { type: "codeBlock", props: { language: "klingon" }, content: "b" },
            ],
            fragment
        );
        const xml = fragment.toString();
        expect(xml).toContain('language="typescript"');
        expect(xml).toContain('language="text"');
        expect(xml).not.toContain('language="ts"');
    });
});
