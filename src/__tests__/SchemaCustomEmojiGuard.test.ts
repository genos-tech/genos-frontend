/**
 * Schema drift guard for the `customEmoji` inline spec.
 *
 * There is no shared schema factory — every editor builds its own
 * `BlockNoteSchema.create({...})` (13 sites at the time of writing).
 * A body containing an inline type that a reader's schema doesn't
 * register makes BlockNote reject the WHOLE body ("node type not found
 * in schema", see bnChatPreview), so a single missed site breaks
 * rendering of any message/note that carries a custom emoji. This scan
 * fails CI the moment someone adds a new schema site without the spec.
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

describe("customEmoji schema registration guard", () => {
    it("every BlockNoteSchema.create site registers the customEmoji spec", () => {
        const offenders: string[] = [];
        let sites = 0;
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            if (!text.includes("BlockNoteSchema.create(")) continue;
            sites += 1;
            if (!text.includes("customEmoji: CreateCustomEmojiSpec(),")) {
                offenders.push(path.relative(SRC_ROOT, file));
            }
        }
        // Sanity: the scan actually found the known editor surfaces.
        expect(sites).toBeGreaterThanOrEqual(13);
        expect(offenders).toEqual([]);
    });
});
