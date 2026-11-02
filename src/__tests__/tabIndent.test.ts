/**
 * Tab indents every selected block (MIP-664).
 *
 * `prefer-indent` makes BlockNote indent a multi-line selection instead of
 * handing Tab to the toolbar that opens over it (jsdom never opens a toolbar,
 * so that half of the cause is read from BlockNote's source, not reproduced).
 * What is held here, on a real editor driven by real keydown events, is that
 * a selection indents together, and that Tab stays in the editor where there
 * is nothing to indent, which BlockNote alone does not do.
 */

import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, describe, expect, it } from "vitest";

import { TAB_INDENT_OPTIONS, tabStaysInEditor } from "../components/editors/sub/tabIndent";

type Shape = (string | Shape[])[];
const shape = (blocks: any[]): Shape =>
    blocks
        .filter((b) => b.id.length === 1)
        .map((b) => (b.children.length ? [b.id, shape(b.children)] : b.id)) as Shape;

const mounted: HTMLElement[] = [];
const make = (ids: string[], options: Record<string, unknown> = {}, blocks?: any[]) => {
    const editor = BlockNoteEditor.create({
        initialContent: (blocks ??
            ids.map((id) => ({ id, type: "paragraph", content: id }))) as any,
        ...options,
    } as any);
    const el = document.createElement("div");
    document.body.appendChild(el);
    mounted.push(el);
    editor.mount(el);
    return editor;
};
afterEach(() => mounted.splice(0).forEach((el) => el.remove()));

const press = (editor: BlockNoteEditor<any, any, any>, key: string, shiftKey = false) => {
    const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true });
    editor.prosemirrorView.dom.dispatchEvent(event);
    return event.defaultPrevented;
};

describe("Tab with the options every editor now gets", () => {
    const withFix = { ...TAB_INDENT_OPTIONS, extensions: [tabStaysInEditor] };

    it("indents every selected block, and Shift+Tab brings them back", () => {
        const editor = make(["a", "b", "c", "d"], withFix);
        editor.setSelection("b", "c");

        expect(press(editor, "Tab")).toBe(true);
        expect(shape(editor.document)).toEqual([["a", ["b", "c"]], "d"]);

        editor.setSelection("b", "c");
        expect(press(editor, "Tab", true)).toBe(true);
        expect(shape(editor.document)).toEqual(["a", "b", "c", "d"]);
    });

    it("indents a selection whose blocks sit at different depths as one group", () => {
        const editor = make(["a", "b", "c", "d"], withFix);
        editor.setSelection("c", "d");
        press(editor, "Tab");
        editor.setSelection("b", "d");

        press(editor, "Tab");

        expect(shape(editor.document)).toEqual([["a", [["b", ["c", "d"]]]]]);
    });

    it("keeps the key in the editor when there is nothing above to nest under", () => {
        const editor = make(["a", "b"], withFix);
        editor.setSelection("a", "b");

        expect(press(editor, "Tab")).toBe(true); // claimed, so focus stays
        expect(shape(editor.document)).toEqual(["a", "b"]); // and nothing changed
    });

    it("keeps Shift+Tab in the editor on a block already at the top level", () => {
        const editor = make(["a", "b"], withFix);
        editor.setTextCursorPosition("b", "end");

        expect(press(editor, "Tab", true)).toBe(true);
        expect(shape(editor.document)).toEqual(["a", "b"]);
    });

    it("leaves Tab to a code block, which indents its own text", () => {
        const editor = make([], withFix, [
            { id: "a", type: "paragraph", content: "a" },
            { id: "b", type: "codeBlock", content: "x" },
        ]);
        editor.setTextCursorPosition("b", "end");

        press(editor, "Tab");

        // Not nested under "a": the code block took the key.
        expect(shape(editor.document)).toEqual(["a", "b"]);
    });
});

describe("what the extension is for", () => {
    it("without it, Tab on the first block is left to the browser, which moves focus away", () => {
        const editor = make(["a", "b"], { ...TAB_INDENT_OPTIONS });
        editor.setTextCursorPosition("a", "end");

        // Not handled, so the browser would take it: focus leaves the editor.
        expect(press(editor, "Tab")).toBe(false);
    });
});
