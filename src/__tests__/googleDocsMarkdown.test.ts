import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { markdownToNoteBlocks } from "../features/notes/common/services/noteMarkdown";

const fixture = readFileSync("src/__tests__/fixtures/googleDocs/export.md", "utf8");

type B = { type: string; props?: Record<string, unknown>; content?: unknown; children?: B[] };
const text = (c: unknown): string =>
    Array.isArray(c)
        ? c.map((i: { text?: string; content?: unknown }) => i.text ?? text(i.content)).join("")
        : "";
const flat = (bs: B[]): B[] => bs.flatMap((b) => [b, ...flat(b.children ?? [])]);

describe("Google Docs Markdown export", () => {
    it("reads headings without literal asterisks and unescapes punctuation", async () => {
        const blocks = (await markdownToNoteBlocks(fixture)) as B[];
        const h = blocks.find((b) => b.type === "heading")!;
        expect(text(h.content)).toBe("Project Plan");
        const para = blocks.find((b) => text(b.content).includes("Smart quotes"))!;
        expect(text(para.content)).toBe(
            "Smart quotes “like this” and it’s fine - with escaped (punctuation) and a_b_c."
        );
    });

    it("unwraps google.com/url redirect links", async () => {
        const all = flat((await markdownToNoteBlocks(fixture)) as B[]);
        const li = all.find((b) => text(b.content).startsWith("Bullet two"))!;
        const link = (li.content as { type: string; href?: string }[]).find(
            (i) => i.type === "link"
        );
        expect(link?.href).toBe("https://example.com/page");
    });

    it("drops the empty table header row and turns <br> into a line break", async () => {
        const blocks = (await markdownToNoteBlocks(fixture)) as B[];
        const table = blocks.find((b) => b.type === "table")!;
        const rows = (table.content as { rows: { cells: unknown[] }[] }).rows;
        expect(rows).toHaveLength(2);
        const cell = JSON.stringify(rows[1].cells[2]);
        expect(cell).not.toContain("<br>");
    });

    it("keeps the footnote, and the embedded image as an image block", async () => {
        const all = flat((await markdownToNoteBlocks(fixture)) as B[]);
        expect(all.some((b) => text(b.content).includes("The footnote text."))).toBe(true);
        expect(all.some((b) => text(b.content).includes("[^1]"))).toBe(false);
        const img = all.find((b) => b.type === "image");
        expect(String(img?.props?.url)).toMatch(/^data:image\/png;base64,/);
    });

    it("keeps underline as a style, not literal tags", async () => {
        const all = flat((await markdownToNoteBlocks(fixture)) as B[]);
        const p = all.find((b) => text(b.content).includes("underlined"))!;
        expect(text(p.content)).not.toContain("<u>");
    });
});

describe("normalizeGoogleDocsMarkdown", () => {
    it("leaves ordinary markdown and code fences untouched", async () => {
        const { normalizeGoogleDocsMarkdown } = await import(
            "../features/notes/common/services/googleDocsMarkdown"
        );
        const plain = "# T\n\ntext [a](https://x.y)\n";
        expect(normalizeGoogleDocsMarkdown(plain)).toBe(plain);
        const code = "```\nconst a = b[0][1]; // [^1]\n```\n";
        expect(normalizeGoogleDocsMarkdown(code)).toBe(code);
    });

    it("resolves reference links and leaves an undefined reference as written", async () => {
        const { normalizeGoogleDocsMarkdown } = await import(
            "../features/notes/common/services/googleDocsMarkdown"
        );
        const out = normalizeGoogleDocsMarkdown(
            "see [doc][d] and [x][nope]\n\n[d]: https://a.b/c\n"
        );
        expect(out).toContain("[doc](https://a.b/c)");
        expect(out).toContain("[x][nope]");
        expect(out).not.toContain("[d]:");
    });
});
