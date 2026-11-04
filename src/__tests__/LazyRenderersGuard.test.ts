/**
 * KaTeX and Mermaid are reached by `import()` only (MIP-1025).
 *
 * They are about 360 kB gzip, and the schemas need the math and diagram specs as soon as an
 * editor mounts. A single static `import katex from "katex"`, or an import of the BlockNote
 * packages that bundle them, anywhere under `src` would put both back into every editor's
 * download and nothing would break: the regression would be silent. So this scan fails the
 * build instead. Same shape as `BlockSpecsGuard`.
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
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
    return out;
};

const rel = (file: string) => path.relative(SRC_ROOT, file);
const HEAVY =
    /(?:from|import)\s*\(?\s*["'](katex|mermaid|@blocknote\/(?:math|diagram)-block)(?:\/[^"']*)?["']/g;
const MODULES = /["'][^"']*\/(katexModule|mermaidModule)["']/g;

describe("the formula and diagram renderers load lazily", () => {
    it("only their own two modules import KaTeX or Mermaid, and nothing imports the BlockNote block packages", () => {
        const found: string[] = [];
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            for (const match of text.matchAll(HEAVY)) found.push(`${rel(file)} -> ${match[1]}`);
        }
        expect(found.sort()).toEqual(
            [
                "components/editors/blocks/katexModule.ts -> katex",
                "components/editors/blocks/katexModule.ts -> katex",
                "components/editors/blocks/mermaidModule.ts -> mermaid",
            ].sort()
        );
    });

    it("the two modules are imported from one place, with import()", () => {
        const users: string[] = [];
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            for (const match of text.matchAll(MODULES)) {
                const before = text.slice(Math.max(0, match.index! - 12), match.index!);
                users.push(
                    `${rel(file)} ${/import\s*\(\s*$/.test(before) ? "dynamic" : "STATIC"} ${match[1]}`
                );
            }
        }
        expect(users.sort()).toEqual(
            [
                "components/editors/blocks/loadRenderers.ts dynamic katexModule",
                "components/editors/blocks/loadRenderers.ts dynamic mermaidModule",
                // the type-only `typeof import("./x")` aliases
                "components/editors/blocks/loadRenderers.ts dynamic katexModule",
                "components/editors/blocks/loadRenderers.ts dynamic mermaidModule",
            ].sort()
        );
    });

    it("KaTeX's stylesheet comes with KaTeX, not with the editors", () => {
        const offenders = walk(SRC_ROOT)
            .filter((file) =>
                /math-block\/style\.css|katex\/dist\/.*\.css/.test(fs.readFileSync(file, "utf8"))
            )
            .map(rel);
        expect(offenders).toEqual(["components/editors/blocks/katexModule.ts"]);
    });
});
