/**
 * Every schema knows the math and diagram blocks (MIP-1019).
 *
 * An editor whose schema lacks a block type DELETES that block from the shared Yjs
 * document when it opens a document that holds one (y-prosemirror drops an element it
 * cannot build, and the deletion syncs to everyone). So a type cannot be in some
 * editors only: a note holding a formula is opened by the note editors, a message
 * preview, a comment editor and the previews, and the markdown an agent writes can
 * land in a comment. There is no shared schema factory (every editor builds its own
 * `BlockNoteSchema.create`), so this scan fails the build the moment one is added
 * without `genosExtraBlockSpecs` and `genosExtraInlineContentSpecs`. Same shape as
 * `StyleSpecsGuard`.
 *
 * The one exception is the schema of BlockNote's own comment composer: it is
 * paragraph-only by design and its documents are comment threads, which the API never
 * writes math into.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "__tests__" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

const PARAGRAPH_ONLY = new Set(["components/editors/sub/CommentEditorWithMentions.tsx"]);

describe("math and diagram blocks guard", () => {
    it("every BlockNoteSchema.create site registers the math and diagram specs", () => {
        const offenders: string[] = [];
        let sites = 0;
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            if (!text.includes("BlockNoteSchema.create(")) continue;
            const rel = path.relative(SRC_ROOT, file);
            if (rel.startsWith("devtools/") || PARAGRAPH_ONLY.has(rel)) continue;
            sites += 1;
            const blocks = /\.\.\.genosExtraBlockSpecs/.test(text);
            const inline = /\.\.\.genosExtraInlineContentSpecs/.test(text);
            if (!blocks || !inline) offenders.push(rel);
        }
        // Sanity: the known surfaces (14 editors and the headless schema).
        expect(sites).toBeGreaterThanOrEqual(15);
        expect(offenders).toEqual([]);
    });

    it("the paragraph-only exception still is paragraph-only", () => {
        for (const rel of PARAGRAPH_ONLY) {
            const text = fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
            expect(text).toMatch(/blockSpecs:\s*\{\s*paragraph:/);
            expect(text).not.toContain("genosExtraBlockSpecs");
        }
    });

    it("the headless schema (compat tool, markdown) carries them and imports no CSS", () => {
        const text = fs.readFileSync(
            path.join(SRC_ROOT, "components/editors/headlessNoteSchema.ts"),
            "utf8"
        );
        expect(text).toContain("...genosExtraBlockSpecs");
        expect(
            fs.readFileSync(path.join(SRC_ROOT, "components/editors/genosBlockSpecs.ts"), "utf8")
        ).not.toMatch(/import\s+["'][^"']+\.css["']/);
    });
});
