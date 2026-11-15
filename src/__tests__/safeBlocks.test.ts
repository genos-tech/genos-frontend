/**
 * MIP-1601: one block BlockNote cannot build used to reject a whole body. `replaceBlocks`,
 * `blocksToYXmlFragment` (the api / agent write path) and `initialContent` convert the body in
 * one step, so a single unknown block type, a style with no spec, a table with no rows, ...
 * lost every other block with it. `sanitizeBlocksForEditor` degrades such a block to plain
 * text (or skips it when it has none) and keeps the rest. Real editors and a real Yjs write.
 */
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { createHeadlessNoteSchema } from "../components/editors/headlessNoteSchema";
import {
    blockPlainText,
    sanitizeBlocksForEditor,
    type SanitizeReport,
} from "../components/editors/safeBlocks";
import { applyBlocksToFragment } from "../features/notes/common/services/applyNoteBodyToYjs";

const schema = createHeadlessNoteSchema();
const mount = (initialContent: unknown): BlockNoteEditor<any, any, any> => {
    const editor = BlockNoteEditor.create({ schema, initialContent } as never) as never;
    (editor as BlockNoteEditor<any, any, any>).mount(
        document.body.appendChild(document.createElement("div"))
    );
    return editor;
};
const p = (content: string) => ({ type: "paragraph", content });

// What each case is, and what is left of it: [block, text it keeps (null: dropped)].
const BAD: Record<string, [unknown, string | null]> = {
    "an unknown block type": [{ type: "fancy", content: "fancy text" }, "fancy text"],
    "an unknown inline type": [
        { type: "paragraph", content: [{ type: "weird", text: "kept words" }] },
        "kept words",
    ],
    "a style with no spec": [
        { type: "paragraph", content: [{ type: "text", text: "styled", styles: { nope: true } }] },
        "styled",
    ],
    "a text run with no text": [
        { type: "paragraph", content: [{ type: "text", styles: {} }] },
        null,
    ],
    "content that is a number": [{ type: "paragraph", content: 5 }, null],
    "a table with no rows": [{ type: "table", content: { type: "tableContent", rows: [] } }, null],
    "a table whose content is text": [{ type: "table", content: "cell text" }, "cell text"],
    "a mention inside a code block": [
        {
            type: "codeBlock",
            props: { language: "ts" },
            content: [
                { type: "text", text: "let a;", styles: {} },
                { type: "mention", props: {} },
            ],
        },
        "let a;",
    ],
    "a null block": [null, null],
};

describe.each(Object.entries(BAD))("%s", (_name, [bad, kept]) => {
    const body = [p("first"), bad, p("last")];

    it("is the block BlockNote rejects, taking the whole body with it (what this fixes)", () => {
        expect(() => mount(body)).toThrow();
    });

    it("degrades, and the body around it survives in a real editor", () => {
        const holder = mount([p("holder")]);
        const report: SanitizeReport = { degraded: 0, skipped: 0 };
        const safe = sanitizeBlocksForEditor(body, holder, report);
        holder.replaceBlocks(holder.document, safe as never);
        const text = holder.document.map((b) => blockPlainText(b));
        expect(text[0]).toBe("first");
        expect(text.at(-1)).toBe("last");
        if (kept === null) {
            expect(text).toEqual(["first", "last"]);
            expect(report.skipped).toBe(1);
        } else {
            expect(text).toEqual(["first", kept, "last"]);
            expect(report.degraded).toBe(1);
        }
    });

    it("does not stop the api / agent write path from writing the rest", () => {
        const doc = new Y.Doc();
        const fragment = doc.getXmlFragment("document-store");
        expect(() => applyBlocksToFragment(body, fragment)).not.toThrow();
        const xml = fragment.toString();
        expect(xml).toContain("first");
        expect(xml).toContain("last");
        if (kept) expect(xml).toContain(kept);
    });
});

describe("sanitizeBlocksForEditor", () => {
    it("returns a body that is fine as it came, by reference", () => {
        const holder = mount([p("holder")]);
        const body = [p("a"), { type: "bulletListItem", content: "b", children: [p("c")] }];
        expect(sanitizeBlocksForEditor(body, holder)).toBe(body);
    });

    it("keeps a good parent and degrades only its bad child", () => {
        const holder = mount([p("holder")]);
        const body = [
            {
                type: "bulletListItem",
                content: "parent",
                children: [{ type: "fancy", content: "child" }, p("sibling")],
            },
        ];
        const safe = sanitizeBlocksForEditor(body, holder) as any[];
        expect(safe[0].type).toBe("bulletListItem");
        expect(safe[0].children.map((c: any) => [c.type, c.content])).toEqual([
            ["paragraph", "child"],
            ["paragraph", "sibling"],
        ]);
    });

    it("keeps the children of a bad parent", () => {
        const holder = mount([p("holder")]);
        const safe = sanitizeBlocksForEditor(
            [{ type: "fancy", content: "parent", children: [p("child")] }],
            holder
        ) as any[];
        expect(safe).toHaveLength(1);
        expect(safe[0].type).toBe("paragraph");
        expect(safe[0].children[0].content).toBe("child");
    });

    it("resolves a code language and keeps the code, in the same pass", () => {
        const holder = mount([p("holder")]);
        const safe = sanitizeBlocksForEditor(
            [{ type: "codeBlock", props: { language: "ts" }, content: "let a;" }],
            holder
        ) as any[];
        expect(safe[0].props.language).toBe("typescript");
        expect(safe[0].content).toBe("let a;");
    });
});

describe("blockPlainText", () => {
    it("reads text from runs, links and table cells", () => {
        expect(
            blockPlainText({
                content: [
                    { type: "text", text: "a ", styles: {} },
                    {
                        type: "link",
                        href: "x",
                        content: [{ type: "text", text: "b", styles: {} }],
                    },
                ],
            })
        ).toBe("a b");
        expect(
            blockPlainText({
                content: { type: "tableContent", rows: [{ cells: ["x", "y"] }, { cells: ["z"] }] },
            })
        ).toBe("x y\nz");
    });
});
