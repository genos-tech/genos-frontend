// Runs the BlockNote compatibility check (MIP-1008): bundles
// src/devtools/blocknoteCompat/cli.ts and runs it under Node, from the repo root,
// against the BlockNote that is installed.
//
//   npm run blocknote-compat -- fixture <outDir>
//   npm run blocknote-compat -- read <dump.jsonl> <outDir>
//   npm run blocknote-compat -- diff <outDirA> <outDirB>
//
// Packages stay external, so the bundle only holds this repo's own code and the
// installed BlockNote is the one that reads the documents.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Inside the repo's node_modules, so the bundle's bare imports (BlockNote, yjs,
// jsdom) resolve from the repo and not from a temp directory.
const cache = join(root, "node_modules", ".cache");
mkdirSync(cache, { recursive: true });
const work = mkdtempSync(join(cache, "blocknote-compat-"));
const bundle = join(work, "cli.mjs");

try {
    await build({
        entryPoints: [join(root, "src/devtools/blocknoteCompat/cli.ts")],
        outfile: bundle,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        // The formula and diagram renderers (KaTeX with its stylesheet, Mermaid) are
        // reached only by dynamic import, when a preview is drawn (MIP-1025). A headless
        // read never draws one, and Node cannot load a .css file: leave them out.
        external: ["./katexModule", "./mermaidModule"],
        logLevel: "warning",
    });
    const run = spawnSync(process.execPath, [bundle, ...process.argv.slice(2)], {
        cwd: root,
        stdio: "inherit",
    });
    process.exitCode = run.status ?? 1;
} finally {
    rmSync(work, { recursive: true, force: true });
}
