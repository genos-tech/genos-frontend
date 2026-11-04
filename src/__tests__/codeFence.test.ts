/**
 * A ``` fence at the start of a paragraph, then Space or Enter (MIP-1011).
 *
 * BlockNote 0.57 turns it into a code block itself, with one input rule that serves both
 * keys. But for a name it does not know (```math, ```nope) that rule puts the TYPED name in
 * the block as its language, and the language dropdown throws while rendering it: the editor
 * is wedged (every later edit throws) until the page is reloaded. `codeFenceInputRule` is a
 * copy of the rule that falls back to plain text. These tests run real 0.57 editors.
 */
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteEditor,
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";
import { describe, expect, it } from "vitest";

import {
    genosExtraBlockSpecs,
    genosExtraInlineContentSpecs,
} from "../components/editors/genosBlockSpecs";
import { genosStyleSpecs } from "../components/editors/genosStyleSpecs";
import { codeFenceInputRule } from "../components/editors/sub/codeBlockExtras";

type AnyEditor = BlockNoteEditor<any, any, any>;

const make = (withRule: boolean): AnyEditor => {
    const schema = BlockNoteSchema.create({
        styleSpecs: genosStyleSpecs,
        inlineContentSpecs: { ...defaultInlineContentSpecs, ...genosExtraInlineContentSpecs },
        blockSpecs: {
            ...defaultBlockSpecs,
            ...genosExtraBlockSpecs,
            codeBlock: createCodeBlockSpec(codeBlockOptions),
        },
    } as never);
    const editor = BlockNoteEditor.create({
        schema,
        initialContent: [
            { type: "paragraph", content: "before" },
            { type: "paragraph", content: "" },
            { type: "paragraph", content: "after" },
        ],
        extensions: withRule ? [codeFenceInputRule] : [],
    } as never) as AnyEditor;
    editor.mount(document.body.appendChild(document.createElement("div")));
    return editor;
};

/** Type `text` into the empty second paragraph, then press a key; what the document is after. */
const typeFence = (withRule: boolean, text: string, key: "Enter" | "Space", mod = false) => {
    const editor = make(withRule);
    editor.updateBlock(editor.document[1], { type: "paragraph", content: text });
    editor.setTextCursorPosition(editor.document[1].id, "end");
    const view = editor.prosemirrorView!;
    if (key === "Space") {
        const { from, to } = view.state.selection;
        view.someProp("handleTextInput", (f: any) => f(view, from, to, " "));
    } else {
        const event = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            metaKey: mod,
            bubbles: true,
            cancelable: true,
        });
        view.someProp("handleKeyDown", (f: any) => f(view, event));
    }
    const cursor = editor.getTextCursorPosition().block;
    return {
        blocks: editor.document.map(
            (b) => b.type + ((b.props as any)?.language ? `:${(b.props as any).language}` : "")
        ),
        cursorIsIn: editor.document.findIndex((b) => b.id === cursor.id),
    };
};

const KEYS = ["Enter", "Space"] as const;

describe.each(KEYS)("``` + %s", (key) => {
    it.each([
        ["```", "javascript"],
        ["```ts", "typescript"],
        ["```python", "python"],
        ["```mermaid", "mermaid"],
    ])("%s makes a %s code block and leaves the cursor inside it", (text, language) => {
        expect(typeFence(true, text, key)).toEqual({
            blocks: ["paragraph", `codeBlock:${language}`, "paragraph"],
            cursorIsIn: 1,
        });
    });

    it.each(["```math", "```nope", "```not-a-language"])(
        "%s (a name that is not a code language) makes a plain-text code block, not a wedged editor",
        (text) => {
            expect(typeFence(true, text, key)).toEqual({
                blocks: ["paragraph", "codeBlock:text", "paragraph"],
                cursorIsIn: 1,
            });
        }
    );

    it("agrees with BlockNote's own rule wherever BlockNote's rule works", () => {
        for (const text of ["```", "```ts", "```python", "```mermaid"]) {
            expect(typeFence(true, text, key), text).toEqual(typeFence(false, text, key));
        }
    });

    it("leaves a paragraph that is not a fence alone", () => {
        expect(typeFence(true, "`` not a fence", key).blocks[1]).toMatch(/^paragraph$/);
    });
});

describe("keys that are not the fence", () => {
    it("Mod-Enter (send, in chat) does not turn the fence into a code block", () => {
        expect(typeFence(true, "```ts", "Enter", true).blocks).toEqual([
            "paragraph",
            "paragraph",
            "paragraph",
        ]);
    });
});

describe("the reason this file exists", () => {
    // CANARY: when BlockNote fixes its rule this fails, and `codeFenceInputRule` (and its
    // 13 uses in the editors) can be deleted.
    it.each(KEYS)("BlockNote's own ``` rule still throws for an unknown name on %s", (key) => {
        expect(() => typeFence(false, "```math", key)).toThrow(/Language math is not supported/);
    });
});
