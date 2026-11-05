/**
 * MIP-1039: what a message body looks like, and what counts as sendable.
 * BlockNote 0.57 no longer keeps a real empty block at the end of the document,
 * so "two blocks" no longer meant "typed something", and dropping the last block
 * unconditionally hid the last real line of every message typed since.
 */
import { describe, expect, it } from "vitest";

import {
    hasSendableContent,
    isBlankParagraph,
    withoutTrailingBlank,
    withTrailingBlank,
} from "../components/editors/utils/messageBlocks";

const p = (text: string, children: unknown[] = []) => ({
    id: Math.random().toString(),
    type: "paragraph",
    props: {},
    content: text === "" ? [] : [{ type: "text", text, styles: {} }],
    children,
});
const blank = () => p("");

describe("hasSendableContent", () => {
    it("is false for an empty editor and for blank lines", () => {
        expect(hasSendableContent([])).toBe(false);
        expect(hasSendableContent([blank()])).toBe(false);
        expect(hasSendableContent([blank(), blank(), blank()])).toBe(false);
    });

    it("is false for spaces only (decided with Ken), including tabs and newlines", () => {
        expect(hasSendableContent([p(" ")])).toBe(false);
        expect(hasSendableContent([p("   "), p("\t"), p(" \n ")])).toBe(false);
    });

    it("is true for one typed character, on a single line (the report)", () => {
        expect(hasSendableContent([p("x")])).toBe(true);
    });

    it("is true when the text is on any line, or nested", () => {
        expect(hasSendableContent([blank(), p("hi")])).toBe(true);
        expect(hasSendableContent([p("", [p("nested")])])).toBe(true);
        expect(
            hasSendableContent([{ type: "bulletListItem", content: [], children: [p("deep")] }])
        ).toBe(true);
    });

    it("is true for a mention or # chip with no text around it", () => {
        expect(
            hasSendableContent([
                { type: "paragraph", content: [{ type: "mention", props: { user: "u1" } }] },
            ])
        ).toBe(true);
    });

    it("judges a link by its label", () => {
        const link = (t: string) => ({
            type: "paragraph",
            content: [{ type: "link", href: "https://x", content: [{ type: "text", text: t }] }],
        });
        expect(hasSendableContent([link("site")])).toBe(true);
        expect(hasSendableContent([link(" ")])).toBe(false);
    });

    it("is true for an image, a file or a table alone", () => {
        expect(hasSendableContent([{ type: "image", props: { url: "u" }, children: [] }])).toBe(
            true
        );
        expect(hasSendableContent([{ type: "file", props: { url: "u" } }])).toBe(true);
        expect(
            hasSendableContent([{ type: "table", content: { type: "tableContent", rows: [] } }])
        ).toBe(true);
    });

    it("is false for an empty heading, quote or code block", () => {
        expect(hasSendableContent([{ type: "heading", content: [] }])).toBe(false);
        expect(hasSendableContent([{ type: "codeBlock", content: [] }])).toBe(false);
        expect(hasSendableContent([{ type: "quote" }])).toBe(false);
    });

    it("tolerates junk", () => {
        expect(hasSendableContent(null)).toBe(false);
        expect(hasSendableContent("text")).toBe(false);
        expect(hasSendableContent([null, 3, "x"])).toBe(false);
    });
});

describe("isBlankParagraph", () => {
    it("is true only for an empty paragraph with nothing nested", () => {
        expect(isBlankParagraph(blank())).toBe(true);
        expect(isBlankParagraph({ type: "paragraph" })).toBe(true);
        expect(isBlankParagraph(p(" "))).toBe(false); // the user typed a space: keep it
        expect(isBlankParagraph(p("", [p("x")]))).toBe(false);
        expect(isBlankParagraph({ type: "heading", content: [] })).toBe(false);
    });
});

describe("withTrailingBlank (what is stored)", () => {
    it("appends one blank paragraph to a body that doesn't end with one", () => {
        const out = withTrailingBlank([p("one")]);
        expect(out).toHaveLength(2);
        expect(isBlankParagraph(out[1])).toBe(true);
        expect((out[1] as { id?: string }).id).toBeTruthy();
    });

    it("always appends exactly one, so a blank line the user typed at the end survives", () => {
        const body = [p("one"), blank()];
        expect(withTrailingBlank(body)).toHaveLength(3);
        expect(withoutTrailingBlank(withTrailingBlank(body))).toHaveLength(2);
    });
});

describe("withoutTrailingBlank (what is shown)", () => {
    it("drops the trailing blank of an old-shape body", () => {
        const body = [p("one"), blank()];
        expect(withoutTrailingBlank(body)).toEqual([body[0]]);
    });

    it("keeps the last line of a new-shape body (the hidden-line bug)", () => {
        const body = [p("FIRST"), p("SECOND")];
        expect(withoutTrailingBlank(body)).toBe(body);
    });

    it("keeps a one-line body whole", () => {
        const body = [p("only")];
        expect(withoutTrailingBlank(body)).toBe(body);
    });

    it("drops only ONE trailing blank: blank lines the user typed stay", () => {
        const body = [p("a"), blank(), blank()];
        expect(withoutTrailingBlank(body)).toHaveLength(2);
    });

    it("never returns an empty list (BlockNote rejects empty initial content)", () => {
        expect(withoutTrailingBlank([])).toHaveLength(1);
        expect(withoutTrailingBlank([blank()])).toHaveLength(1);
    });

    it("round-trips: what is stored shows exactly what was typed", () => {
        for (const typed of [[p("x")], [p("a"), p("b")], [p("a"), blank()]]) {
            expect(withoutTrailingBlank(withTrailingBlank(typed))).toEqual(typed);
        }
    });
});

// The assumption the whole fix rests on, pinned against the real editor: after
// typing one line, BlockNote 0.57's document is ONE block (no automatic empty
// block follows it). If a later upgrade changes that, the helpers above still
// hold, and this says so.
describe("against the real BlockNote editor", () => {
    it("a single typed line is a one-block document that is sendable, shown whole", async () => {
        const { BlockNoteEditor } = await import("@blocknote/core");
        const editor = BlockNoteEditor.create();
        editor.replaceBlocks(editor.document, [
            { type: "paragraph", content: [{ type: "text", text: "x", styles: {} }] },
        ]);

        expect(editor.document).toHaveLength(1);
        expect(hasSendableContent(editor.document)).toBe(true);
        expect(withoutTrailingBlank(editor.document)).toHaveLength(1);
        expect(withTrailingBlank(editor.document)).toHaveLength(2);
    });

    it("a fresh editor holds only a blank line, which is not sendable", async () => {
        const { BlockNoteEditor } = await import("@blocknote/core");
        const editor = BlockNoteEditor.create();

        expect(hasSendableContent(editor.document)).toBe(false);
    });
});
