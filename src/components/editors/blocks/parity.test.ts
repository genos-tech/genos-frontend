/**
 * Our math and diagram specs against the packages they were written from (MIP-1025).
 *
 * `@blocknote/math-block` and `@blocknote/diagram-block` are DEV dependencies, used here
 * only. The editors ship our own specs (KaTeX and Mermaid load on first use), and a spec
 * that differs from the package in its content expression, marks or node flags would be
 * another schema: an editor with it deletes the packages' blocks from a shared document,
 * and the other way round. So everything a stored document, the Yjs binding, copy and paste
 * and the strings depend on is compared with the installed package, not described.
 */
import {
    BlockNoteEditor,
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";
import { blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { createReactDiagramBlockSpec, locales as diagramLocales } from "@blocknote/diagram-block";
import {
    createReactInlineMathSpec,
    createReactMathBlockSpec,
    locales as mathLocales,
} from "@blocknote/math-block";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { genosExtraBlockSpecs, genosExtraInlineContentSpecs } from "../genosBlockSpecs";
import { diagramDictionaries, mathDictionaries } from "./mathDiagramDictionaries";

const FRAGMENT = "document-store";

const ours = () =>
    BlockNoteSchema.create({
        blockSpecs: { ...defaultBlockSpecs, ...genosExtraBlockSpecs },
        inlineContentSpecs: { ...defaultInlineContentSpecs, ...genosExtraInlineContentSpecs },
    });

const theirs = () =>
    BlockNoteSchema.create({
        blockSpecs: {
            ...defaultBlockSpecs,
            mathBlock: createReactMathBlockSpec(),
            diagram: createReactDiagramBlockSpec(),
        },
        inlineContentSpecs: { ...defaultInlineContentSpecs, math: createReactInlineMathSpec() },
    });

const editorOf = (schema: ReturnType<typeof ours>) => BlockNoteEditor.create({ schema } as never);

/** A ProseMirror node spec without its functions (`toDOM`, `parseDOM` rules): the data. */
const dataOf = (spec: unknown) =>
    JSON.parse(
        JSON.stringify(spec, (_key, value) => (typeof value === "function" ? undefined : value))
    );

const text = (value: string, styles: Record<string, boolean> = {}) => ({
    type: "text",
    text: value,
    styles,
});
const DIAGRAM = "graph TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]";
const BLOCKS = [
    {
        id: "p0",
        type: "paragraph",
        props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: [
            text("Energy "),
            { type: "math", props: {}, content: "E=mc^2" },
            text(" ok", { bold: true }),
        ],
        children: [],
    },
    { id: "m1", type: "mathBlock", props: {}, content: [text("x^2 + y^2 = z^2")], children: [] },
    { id: "m2", type: "mathBlock", props: {}, content: [text("a = b \\\\\nc = d")], children: [] },
    { id: "m3", type: "mathBlock", props: {}, content: [], children: [] },
    { id: "d1", type: "diagram", props: {}, content: [text(DIAGRAM)], children: [] },
    { id: "d2", type: "diagram", props: {}, content: [], children: [] },
    {
        id: "l1",
        type: "bulletListItem",
        props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: [text("with blocks below")],
        children: [
            { id: "l2", type: "mathBlock", props: {}, content: [text("a^2")], children: [] },
        ],
    },
];

describe("the specs against the packages", () => {
    it("have the same type, props and content kind", () => {
        const a = ours();
        const b = theirs();
        for (const type of ["mathBlock", "diagram"]) {
            expect(a.blockSpecs[type].config, type).toEqual(b.blockSpecs[type].config);
        }
        expect(a.inlineContentSpecs.math.config).toEqual(b.inlineContentSpecs.math.config);
    });

    it("build the same ProseMirror nodes: content expression, marks, flags, attributes", () => {
        const a = editorOf(ours()).pmSchema.nodes;
        const b = editorOf(theirs()).pmSchema.nodes;
        for (const name of ["mathBlock", "diagram", "math"]) {
            expect(a[name], `${name} exists`).toBeDefined();
            expect(dataOf(a[name].spec), name).toEqual(dataOf(b[name].spec));
        }
    });

    it("write the same Yjs XML and read it back as the same blocks", () => {
        const write = (schema: ReturnType<typeof ours>) => {
            const editor = editorOf(schema);
            const doc = new Y.Doc();
            blocksToYXmlFragment(editor, BLOCKS as never, doc.getXmlFragment(FRAGMENT));
            return {
                xml: doc.getXmlFragment(FRAGMENT).toString(),
                back: JSON.parse(
                    JSON.stringify(yXmlFragmentToBlocks(editor, doc.getXmlFragment(FRAGMENT)))
                ),
            };
        };
        const mine = write(ours());
        const theirsOut = write(theirs());
        expect(mine.xml).toBe(theirsOut.xml);
        expect(mine.xml).toContain("<mathblock>");
        expect(mine.back).toEqual(theirsOut.back);
        expect(mine.back).toEqual(BLOCKS);
    });

    it("read pasted HTML the same way", () => {
        const html = [
            '<math display="block"><semantics><annotation encoding="application/x-tex">x^2</annotation></semantics></math>',
            '<p>see <math display="inline"><semantics><annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math></p>',
            '<pre><code class="language-mermaid">graph LR; A--&gt;B</code></pre>',
            '<pre><code class="language-js">const a = 1;</code></pre>',
        ].join("");
        const parse = (schema: ReturnType<typeof ours>) =>
            JSON.parse(
                JSON.stringify(editorOf(schema).tryParseHTMLToBlocks(html), (k, v) =>
                    k === "id" ? undefined : v
                )
            );
        const mine = parse(ours());
        expect(mine).toEqual(parse(theirs()));
        expect(mine.map((b: { type: string }) => b.type)).toEqual([
            "mathBlock",
            "paragraph",
            "diagram",
            "codeBlock",
        ]);
    });

    it("have the packages' strings, in the app's six languages", () => {
        for (const language of ["ar", "en", "es", "fr", "ja", "zh"] as const) {
            const { exporter: mathExporter, ...math } = (mathLocales as Record<string, any>)[
                language
            ];
            const { exporter: diagramExporter, ...diagram } = (
                diagramLocales as Record<string, any>
            )[language];
            void mathExporter;
            void diagramExporter;
            expect(dataOf(mathDictionaries[language]), `math ${language}`).toEqual(dataOf(math));
            expect(dataOf(diagramDictionaries[language]), `diagram ${language}`).toEqual(
                dataOf(diagram)
            );
        }
    });
});

describe("copy and paste", () => {
    const roundTrip = (schema: ReturnType<typeof ours>, blocks: unknown[]) => {
        const editor = editorOf(schema);
        const html = editor.blocksToHTMLLossy(blocks as never);
        return JSON.parse(
            JSON.stringify(editor.tryParseHTMLToBlocks(html), (key, value) =>
                key === "id" ? undefined : value
            )
        );
    };
    const withoutIds = (blocks: unknown[]) =>
        JSON.parse(JSON.stringify(blocks, (key, value) => (key === "id" ? undefined : value)));
    // The first six blocks are top level; the list item with a block below it nests.
    const TOP_LEVEL = BLOCKS.slice(0, 6);

    it("come back from a copy as the package's do, for every block", () => {
        expect(roundTrip(ours(), BLOCKS)).toEqual(roundTrip(theirs(), BLOCKS));
    });

    it("survive being copied as HTML and pasted back", () => {
        // A line break inside a formula's source becomes a space on this path, in the
        // package as in ours (HTML collapses it): the multi-line block is left out here and
        // covered by the comparison above.
        const kept = TOP_LEVEL.filter((block) => block.id !== "m2");
        expect(roundTrip(ours(), kept)).toEqual(withoutIds(kept));
    });

    it("write a copy KaTeX is not needed for: MathML with the source as an annotation", () => {
        const html = editorOf(ours()).blocksToHTMLLossy([BLOCKS[1]] as never);
        expect(html).toContain("<math");
        expect(html).toContain('encoding="application/x-tex"');
        expect(html).toContain("x^2 + y^2 = z^2");
        expect(html).not.toContain("katex");
    });
});
