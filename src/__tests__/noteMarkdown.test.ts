import { describe, expect, it } from "vitest";

import {
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
