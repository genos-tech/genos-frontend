/**
 * Inline code can be combined with other styles (MIP-1009).
 *
 * BlockNote 0.57 checks block JSON before it builds a document, and its `code`
 * style excludes every other style, so a text node that is bold AND code throws
 * "Invalid collection of marks for node text: bold,code". BlockNote 0.49 did not
 * check, and production holds 310 messages, comments and task bodies with that
 * combination (and 1 with italic and code). `genosStyleSpecs` keeps the code
 * style and drops only the exclusion, so they load, and look, as before.
 *
 * What is held here: those shapes load through every way block JSON reaches an
 * editor (`initialContent`, `replaceBlocks`, `insertBlocks`); stock BlockNote
 * still rejects them (so a BlockNote that stops needing this makes a test fail
 * and the override can go); and nothing else about the style set changed.
 */

import { BlockNoteEditor, BlockNoteSchema, defaultStyleSpecs } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { genosStyleSpecs } from "../components/editors/genosStyleSpecs";

const paragraph = (content: unknown[]) => ({ id: "p", type: "paragraph", content });
const text = (value: string, styles: Record<string, unknown>) => ({
    type: "text",
    text: value,
    styles,
});

const ours = BlockNoteSchema.create({ styleSpecs: genosStyleSpecs });
const stock = BlockNoteSchema.create();

const COMBINATIONS: [string, Record<string, unknown>][] = [
    ["bold and code", { bold: true, code: true }],
    ["italic and code", { italic: true, code: true }],
    ["underline and code", { underline: true, code: true }],
    ["strike and code", { strike: true, code: true }],
    ["code on a text color", { code: true, textColor: "red" }],
    ["code on a background color", { code: true, backgroundColor: "blue" }],
    [
        "every style at once",
        { bold: true, italic: true, underline: true, strike: true, code: true },
    ],
];

describe("a body with inline code combined with other styles", () => {
    it.each(COMBINATIONS)("loads as initialContent: %s", (_name, styles) => {
        const body = [paragraph([text("a", styles)])];

        const editor = BlockNoteEditor.create({ schema: ours, initialContent: body as never });

        const read = (editor.document[0].content as { styles: object }[])[0];
        expect(read.styles).toEqual(styles);
    });

    it.each(COMBINATIONS)(
        "is rejected by stock BlockNote (the reason for this module): %s",
        (_name, styles) => {
            const body = [paragraph([text("a", styles)])];

            expect(() =>
                BlockNoteEditor.create({ schema: stock, initialContent: body as never })
            ).toThrow(/initialContent/);
        }
    );

    it("loads through replaceBlocks", () => {
        const editor = BlockNoteEditor.create({ schema: ours });

        editor.replaceBlocks(editor.document, [
            paragraph([text("a", { bold: true, code: true })]),
        ] as never);

        expect((editor.document[0].content as { text: string }[])[0].text).toBe("a");
    });

    it("loads through insertBlocks", () => {
        const editor = BlockNoteEditor.create({ schema: ours });

        editor.insertBlocks(
            [paragraph([text("a", { bold: true, code: true })])] as never,
            editor.document[0],
            "after"
        );

        expect(editor.document).toHaveLength(2);
    });

    it("loads code inside a link", () => {
        const body = [
            paragraph([
                {
                    type: "link",
                    href: "https://example.org/x",
                    content: [text("name", { code: true })],
                },
            ]),
        ];

        const editor = BlockNoteEditor.create({ schema: ours, initialContent: body as never });

        const link = (editor.document[0].content as { type: string }[])[0];
        expect(link.type).toBe("link");
    });

    it("keeps combined styles through a Yjs round trip", async () => {
        const { roundTripThroughYjs } = await import("../devtools/blocknoteCompat/compat");
        const body = [paragraph([text("a", { bold: true, code: true })])];

        const back = roundTripThroughYjs(body as never) as { content: { styles: object }[] }[];

        expect(back[0].content[0].styles).toEqual({ bold: true, code: true });
    });
});

describe("what genosStyleSpecs leaves alone", () => {
    it("changes only the code style: every other style spec is BlockNote's own object", () => {
        const others = Object.keys(defaultStyleSpecs).filter((key) => key !== "code");

        expect(Object.keys(genosStyleSpecs).sort()).toEqual(Object.keys(defaultStyleSpecs).sort());
        for (const key of others) {
            expect(genosStyleSpecs[key as keyof typeof genosStyleSpecs]).toBe(
                defaultStyleSpecs[key as keyof typeof defaultStyleSpecs]
            );
        }
    });

    it("keeps the code style's own config and rendering", () => {
        expect(genosStyleSpecs.code.config).toEqual(defaultStyleSpecs.code.config);
        expect(genosStyleSpecs.code.implementation.render).toBe(
            defaultStyleSpecs.code.implementation.render
        );
    });

    it("still renders inline code as a code element", () => {
        const editor = BlockNoteEditor.create({
            schema: ours,
            initialContent: [paragraph([text("fn", { code: true })])] as never,
        });

        expect(editor.blocksToFullHTML(editor.document)).toContain("<code>");
    });

    it("only the code style's exclusion is gone: it excludes nothing in this schema", () => {
        const editor = BlockNoteEditor.create({ schema: ours });
        const stockEditor = BlockNoteEditor.create({ schema: stock });

        expect(editor.pmSchema.marks.code.excluded.map((m) => m.name)).toEqual([]);
        expect(stockEditor.pmSchema.marks.code.excluded.map((m) => m.name)).toContain("bold");
    });
});
