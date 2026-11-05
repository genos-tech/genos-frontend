import { describe, expect, it } from "vitest";

import {
    findInlineMath,
    markdownFilename,
    markdownToNoteBlocks,
    noteBlocksToMarkdown,
    sanitizeBlocksForMarkdown,
    titleFromFilename,
} from "../features/notes/common/services/noteMarkdown";

describe("markdownToNoteBlocks", () => {
    it("parses rich markdown into typed blocks", async () => {
        const blocks = await markdownToNoteBlocks(
            "# Title\n\nSome **bold** text\n\n- a\n- b\n\n```js\nconst x = 1;\n```\n\n> quoted"
        );
        const types = blocks.map((b) => b.type);
        expect(types).toContain("heading");
        expect(types).toContain("bulletListItem");
        expect(types).toContain("codeBlock");
        expect(types).toContain("quote");
    });

    it("returns a single empty paragraph for empty input", async () => {
        const blocks = await markdownToNoteBlocks("");
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        expect(blocks[0].type).toBe("paragraph");
    });
});

describe("noteBlocksToMarkdown", () => {
    it("serializes default blocks to markdown", async () => {
        const md = await noteBlocksToMarkdown([
            { type: "heading", props: { level: 2 }, content: "Hello" },
            { type: "paragraph", content: "world" },
        ]);
        expect(md).toContain("## Hello");
        expect(md).toContain("world");
    });

    it("degrades custom inline types instead of throwing", async () => {
        // mention / hashTask are notes-schema customs the default-schema
        // serializer would reject ("node type mention not found").
        const md = await noteBlocksToMarkdown([
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "ping ", styles: {} },
                    { type: "mention", props: { userName: "Alice", userId: "1" } },
                    { type: "text", text: " re ", styles: {} },
                    {
                        type: "hashTask",
                        props: { displayId: "GEN-42", title: "Fix login", taskId: "42" },
                    },
                ],
            },
        ]);
        expect(md).toContain("@Alice");
        expect(md).toContain("#GEN-42 · Fix login");
    });

    it("exports a customEmoji inline as its :shortcode:, not a prop dump", async () => {
        // Without an explicit case the default branch would emit the
        // first string prop — the name OR the URL, whichever the props
        // object happens to order first.
        const md = await noteBlocksToMarkdown([
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "ship it ", styles: {} },
                    {
                        type: "customEmoji",
                        props: { name: "party-blob", url: "https://x/media/p.gif" },
                    },
                ],
            },
        ]);
        expect(md).toContain(":party-blob:");
        expect(md).not.toContain("https://x/media/p.gif");
    });

    it("degrades custom blocks (alert) to paragraphs", async () => {
        const md = await noteBlocksToMarkdown([
            {
                type: "alert",
                props: { type: "warning" },
                content: [{ type: "text", text: "careful", styles: {} }],
            },
        ]);
        expect(md).toContain("careful");
    });

    it("round-trips markdown → blocks → markdown", async () => {
        const source = "## Notes\n\nSome **bold** and *italic* text\n\n* one\n* two\n";
        const blocks = await markdownToNoteBlocks(source);
        const md = await noteBlocksToMarkdown(blocks as unknown[]);
        expect(md).toContain("## Notes");
        expect(md).toContain("**bold**");
        expect(md).toContain("*italic*");
        expect(md).toContain("* one");
    });
});

// A link's address must come back from export → import as the same string.
// BlockNote 0.51's markdown parser keeps the backslash escapes of a link
// destination in the href (`Foo_(bar)` came back as `Foo_\(bar\)`, a broken
// address), and its serializer writes a raw space into a destination, which
// ends the link there. MIP-1009 measured it on the production notes: 50 links
// in 38 documents carry parentheses.
describe("link addresses through export and import", () => {
    const hrefsOf = (blocks: unknown): string[] => {
        const found: string[] = [];
        const walk = (value: unknown) => {
            if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === "object") {
                const node = value as Record<string, unknown>;
                if (node.type === "link" && typeof node.href === "string") found.push(node.href);
                Object.values(node).forEach(walk);
            }
        };
        walk(blocks);
        return found;
    };
    const roundTrip = async (href: string) => {
        const md = await noteBlocksToMarkdown([
            {
                type: "paragraph",
                content: [
                    {
                        type: "link",
                        href,
                        content: [{ type: "text", text: "t", styles: {} }],
                    },
                ],
            },
        ]);
        return hrefsOf(await markdownToNoteBlocks(md));
    };

    it.each([
        ["plain", "https://example.com/a/b?x=1&y=2#frag"],
        ["parentheses", "https://example.com/wiki/Foo_(bar)"],
        ["nested parentheses", "https://example.com/a_(b_(c))"],
        ["a closing parenthesis alone", "https://example.com/x)"],
        ["an opening parenthesis alone", "https://example.com/x("],
        ["a backslash", "https://example.com/a\\b"],
        ["a percent-encoded space", "https://example.com/a%20b"],
        ["square brackets", "https://example.com/a[1]/b"],
        ["non-ASCII", "https://example.com/café/日本"],
    ])("keeps an address with %s", async (_name, href) => {
        expect(await roundTrip(href)).toEqual([href]);
    });

    it("writes a space in an address as %20, which keeps the link whole", async () => {
        expect(await roundTrip("https://example.com/a b")).toEqual(["https://example.com/a%20b"]);
    });

    it("reads the backslash escapes of a destination in a markdown file", async () => {
        const blocks = await markdownToNoteBlocks("[wiki](https://example.com/Foo_\\(bar\\))");
        expect(hrefsOf(blocks)).toEqual(["https://example.com/Foo_(bar)"]);
    });

    it("also fixes links inside table cells and nested list items", async () => {
        const blocks = await markdownToNoteBlocks(
            "| a |\n| --- |\n| [x](https://example.com/p_\\(q\\)) |\n\n- one\n  - [y](https://example.com/r_\\(s\\))"
        );
        expect(hrefsOf(blocks).sort()).toEqual(
            ["https://example.com/p_(q)", "https://example.com/r_(s)"].sort()
        );
    });

    it("leaves the text around a link alone", async () => {
        const blocks = await markdownToNoteBlocks("a \\(b\\) [t](https://example.com/c)");
        const text = JSON.stringify(blocks);
        expect(text).toContain("a (b) ");
        expect(hrefsOf(blocks)).toEqual(["https://example.com/c"]);
    });
});

describe("sanitizeBlocksForMarkdown", () => {
    it("keeps default blocks and recurses into children", () => {
        const out = sanitizeBlocksForMarkdown([
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "parent", styles: {} }],
                children: [
                    {
                        type: "alert",
                        content: [{ type: "mention", props: { userName: "Bob" } }],
                    },
                ],
            },
        ]);
        expect(out[0].type).toBe("bulletListItem");
        const child = (out[0].children as Array<{ type: string; content: unknown }>)[0];
        expect(child.type).toBe("paragraph");
        expect(JSON.stringify(child.content)).toContain("@Bob");
    });

    it("handles non-array input defensively", () => {
        expect(sanitizeBlocksForMarkdown(null as unknown as unknown[])).toEqual([]);
    });
});

describe("filename helpers", () => {
    it("builds a filesystem-safe .md filename from a title", () => {
        expect(markdownFilename("My Note: draft/v2")).toBe("My Note draft v2.md");
        expect(markdownFilename("")).toBe("note.md");
    });

    it("derives the default title from the imported filename", () => {
        expect(titleFromFilename("meeting-notes.md")).toBe("meeting-notes");
        expect(titleFromFilename("README.markdown")).toBe("README");
        expect(titleFromFilename("notes.txt")).toBe("notes");
        expect(titleFromFilename(".md")).toBe("Imported note");
    });
});

// Math and diagram blocks (MIP-1019): written as `math` / `mermaid` fences and
// `$source$`, and read back from the same forms. The inline rule is the one in the
// API's `blocknote_md.py` (`_INLINE_MATH_RE`); the cases below are the ones its tests use.
describe("math and diagram blocks through markdown", () => {
    const text = (value: string, styles: Record<string, boolean> = {}) => ({
        type: "text",
        text: value,
        styles,
    });
    const math = (source: string) => ({ type: "math", props: {}, content: source });
    const strip = (blocks: unknown): unknown =>
        JSON.parse(JSON.stringify(blocks, (key, value) => (key === "id" ? undefined : value)));
    const DIAGRAM = "graph TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]";

    describe("findInlineMath", () => {
        it.each([
            ["Energy $E=mc^2$ in joules", ["E=mc^2"]],
            ["$a$ and $b_1$", ["a", "b_1"]],
            ["($x$)", ["x"]],
            ["エネルギーは$E=mc^2$です", ["E=mc^2"]],
            ["$a_1*b_2$", ["a_1*b_2"]],
        ])("finds the formulas in %j", (input, expected) => {
            expect(findInlineMath(input).map((m) => m.source)).toEqual(expected);
        });

        it.each([
            "costs $5 and $10",
            "between $5-$10",
            "pay $5.",
            "$5",
            "US$100 or $200 total",
            "a $ b $ c",
            "price: $5, tax: $0.50",
            "echo $HOME/$USER",
            "$a$b",
            "x$y$ z",
            "<?= $a ?>/<?= $b ?>",
            "\\$5 and \\$6",
            "a $$x$$ b",
        ])("leaves %j as text", (input) => {
            expect(findInlineMath(input)).toEqual([]);
        });
    });

    describe("export", () => {
        it("writes a math block and a diagram as fences", async () => {
            const md = await noteBlocksToMarkdown([
                { type: "mathBlock", props: {}, content: [text("x^2 + y^2 = z^2")] },
                { type: "diagram", props: {}, content: [text(DIAGRAM)] },
            ]);
            expect(md).toContain("```math\nx^2 + y^2 = z^2\n```");
            expect(md).toContain("```mermaid\n" + DIAGRAM + "\n```");
        });

        it("writes inline math between dollar signs, and keeps the text around it", async () => {
            const md = await noteBlocksToMarkdown([
                {
                    type: "paragraph",
                    content: [text("Energy "), math("E=mc^2"), text(" in joules")],
                },
            ]);
            expect(md.trim()).toBe("Energy $E=mc^2$ in joules");
        });

        it("writes a source a dollar pair cannot carry as a code span, and drops an empty one", async () => {
            const md = await noteBlocksToMarkdown([
                {
                    type: "paragraph",
                    content: [math("a $ b"), text(" and "), math(" "), text("end")],
                },
            ]);
            expect(md.trim()).toBe("`a $ b` and end");
        });

        it("writes an empty math block as an empty fence", async () => {
            const md = await noteBlocksToMarkdown([{ type: "mathBlock", props: {}, content: [] }]);
            expect(md).toContain("```math");
        });
    });

    describe("import", () => {
        it("reads the fences as blocks", async () => {
            const blocks = await markdownToNoteBlocks(
                "```math\nx^2 + y^2 = z^2\n```\n\n```mermaid\n" + DIAGRAM + "\n```"
            );
            expect(strip(blocks)).toEqual([
                { type: "mathBlock", props: {}, content: [text("x^2 + y^2 = z^2")], children: [] },
                { type: "diagram", props: {}, content: [text(DIAGRAM)], children: [] },
            ]);
        });

        it("reads a `$$` display block as a math block", async () => {
            for (const markdown of ["$$\nx^2\n$$", "$$ x^2 $$", "$$x^2$$"]) {
                const blocks = (await markdownToNoteBlocks(markdown)) as { type: string }[];
                expect(
                    blocks.map((b) => b.type),
                    markdown
                ).toEqual(["mathBlock"]);
            }
        });

        it("reads inline math, and leaves amounts and variables as text", async () => {
            const [formula, amounts] = (await markdownToNoteBlocks(
                "Energy $E=mc^2$ in joules\n\ncosts $5 and $10, echo $HOME/$USER"
            )) as { content: unknown[] }[];
            expect(strip(formula.content)).toEqual([
                text("Energy "),
                math("E=mc^2"),
                text(" in joules"),
            ]);
            expect(strip(amounts.content)).toEqual([text("costs $5 and $10, echo $HOME/$USER")]);
        });

        it("keeps code spans, other fences and links as they are", async () => {
            const blocks = (await markdownToNoteBlocks(
                "`$x$` and [a](https://example.com/$y$)\n\n```latex\n\\frac{a}{b}\n```"
            )) as { type: string; content: { type: string }[] }[];
            expect(blocks[0].content.map((i) => i.type)).toEqual(["text", "text", "link"]);
            expect(blocks[1].type).toBe("codeBlock");
        });

        it("reads inline math in a heading, a list item and a table cell", async () => {
            const [heading, bullet, table] = (await markdownToNoteBlocks(
                "# Area $A$\n\n- uses $B$\n\n| h |\n| - |\n| $C$ |"
            )) as { content: unknown }[];
            expect(JSON.stringify(heading.content)).toContain('"type":"math"');
            expect(JSON.stringify(bullet.content)).toContain('"type":"math"');
            expect(JSON.stringify(table.content)).toContain('"type":"math"');
        });
    });

    describe("round trip", () => {
        it.each([
            [
                "a math block",
                { type: "mathBlock", props: {}, content: [text("x^2 + y^2 = z^2")], children: [] },
            ],
            [
                "a multi-line math block",
                {
                    type: "mathBlock",
                    props: {},
                    content: [text("a = b\\\\\nc = d")],
                    children: [],
                },
            ],
            ["a diagram", { type: "diagram", props: {}, content: [text(DIAGRAM)], children: [] }],
        ])("keeps %s through export then import", async (_name, block) => {
            const back = await markdownToNoteBlocks(await noteBlocksToMarkdown([block]));
            expect(strip(back)).toEqual([block]);
        });

        it("keeps inline math in a paragraph", async () => {
            const content = [text("Energy "), math("E=mc^2"), text(" in joules")];
            const md = await noteBlocksToMarkdown([{ type: "paragraph", content }]);
            const [back] = (await markdownToNoteBlocks(md)) as { content: unknown }[];
            expect(strip(back.content)).toEqual(content);
        });
    });
});
