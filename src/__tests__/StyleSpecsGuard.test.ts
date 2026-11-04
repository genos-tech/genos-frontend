/**
 * Every schema uses `genosStyleSpecs` (MIP-1009).
 *
 * A schema built from BlockNote's own styles rejects a body that has inline code
 * combined with another style (BlockNote 0.57 throws "Invalid collection of marks
 * for node text: bold,code" when it is loaded), and production has 310 such
 * messages, comments and task bodies. There is no shared schema factory (every
 * editor builds its own `BlockNoteSchema.create`), so this scan fails the build
 * the moment one is added without `genosStyleSpecs`. Same shape as the custom
 * emoji guard.
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

// The comment schema starts from `genosStyleSpecs` and drops the color styles.
const USES_THEM = /styleSpecs:\s*genosStyleSpecs|\.\.\.styleSpecs\s*\}\s*=\s*genosStyleSpecs/;

describe("genosStyleSpecs guard", () => {
    it("every BlockNoteSchema.create site builds its styles from genosStyleSpecs", () => {
        const offenders: string[] = [];
        let sites = 0;
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            if (!text.includes("BlockNoteSchema.create(")) continue;
            if (path.relative(SRC_ROOT, file).startsWith("devtools/")) continue;
            sites += 1;
            if (!USES_THEM.test(text)) offenders.push(path.relative(SRC_ROOT, file));
        }
        // Sanity: the scan found the known surfaces (15 editors and the headless schema).
        expect(sites).toBeGreaterThanOrEqual(16);
        expect(offenders).toEqual([]);
    });
});
