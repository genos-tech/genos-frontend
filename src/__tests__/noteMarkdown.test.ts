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
