import { gzipSync } from "node:zlib";
import type { Plugin } from "vite";

// Build-time guard on the entry's critical path.
//
// WHY THIS EXISTS: `vendor-editor` (BlockNote/Yjs/Hocuspocus/Shiki, ~720 kB
// gzip) has been removed from the initial critical path TWICE — PR #33, then
// again in PR #196 — and re-attached itself both times. Each regression was a
// single innocuous static import in a feature PR, invisible in review, and
// silent at runtime: nothing breaks, the app just downloads three quarters of
// a megabyte it never uses. Reviews do not catch this. A build does.
//
// Two checks with deliberately different severities:
//
//   1. STRUCTURAL (hard failure). A chunk that is supposed to be lazy must not
//      appear in the entry's transitive STATIC imports. This cannot trip
//      spuriously — if vendor-editor is reachable statically from the entry,
//      that is a bug every time, and the fix is small (find the edge, make it
//      dynamic or split the module). Escape hatch below for emergencies.
//
//   2. BUDGET (warning only). Total gzip of the critical path. This one is
//      advisory on purpose: legitimate features do add bytes, and a build that
//      refuses to produce a deployable artifact over a size threshold is a bad
//      trade. It prints the number on every build so drift stays visible.

// Chunks that must never be statically reachable from the entry. Names come
// from `manualChunks` in vite.config.ts. Add to this list when you split a
// heavy dependency out — that is what keeps it split.
const MUST_STAY_LAZY = [
    "vendor-editor", // BlockNote + Yjs + Hocuspocus + Shiki
    "vendor-emoji", // emoji-mart + its data
    "vendor-dnd", // @hello-pangea/dnd
];

// Advisory ceiling for entry + transitive static imports + CSS, gzipped.
// Measured at 695 kB after the #196-#199 series; the headroom is for normal
// feature growth, not for re-admitting a vendor chunk.
const CRITICAL_PATH_BUDGET_KB = 760;

// Emergency override. If you ever genuinely need to ship with a guard
// violation, set SKIP_BUNDLE_GUARD=1 — but prefer fixing the edge: every
// occurrence so far has been a one-line import, not a design constraint.
const skip = () => process.env.SKIP_BUNDLE_GUARD === "1";

export const bundleGuard = (): Plugin => ({
    name: "bundle-guard",
    apply: "build",
    generateBundle(_options, bundle) {
        const chunks = Object.entries(bundle).filter(([, c]) => c.type === "chunk") as [
            string,
            Extract<(typeof bundle)[string], { type: "chunk" }>,
        ][];

        const entry = chunks.find(([, c]) => c.isEntry);
        if (!entry) return;

        // Walk static imports transitively — this mirrors exactly what Vite
        // emits as <link rel="modulepreload"> in index.html, i.e. what the
        // browser must fetch before the app can run.
        const byFile = new Map(chunks);
        const reachable = new Set<string>();
        const queue = [entry[0]];
        while (queue.length) {
            const file = queue.shift()!;
            for (const dep of byFile.get(file)?.imports ?? []) {
                if (reachable.has(dep)) continue;
                reachable.add(dep);
                queue.push(dep);
            }
        }

        // --- 1. structural ---
        const leaked = [...reachable]
            .map((file) => ({ file, name: byFile.get(file)?.name }))
            .filter((c) => c.name && MUST_STAY_LAZY.includes(c.name));

        if (leaked.length) {
            const detail = leaked.map((c) => `  - ${c.name} (${c.file})`).join("\n");
            const message =
                `chunk(s) that must stay lazy are statically reachable from the ` +
                `entry:\n${detail}\n\n` +
                `Something now imports one of these at module scope on a path ` +
                `reachable from main.tsx, so every page load — including signin — ` +
                `downloads and executes it.\n\n` +
                `To find the edge: add a Rollup plugin that BFSes ` +
                `this.getModuleInfo(id).importedIds from the entry facade and ` +
                `prints the shortest path to a module in the offending chunk. ` +
                `Chunk-level imports tell you an edge exists; only the module ` +
                `walk names the source file.\n\n` +
                `Usual fixes: make the import dynamic (await import()) if it is ` +
                `on an async path, or split the module if it serves both an eager ` +
                `and a lazy audience — both past regressions were the latter.`;
            if (skip()) {
                this.warn(`[bundle-guard] SKIPPED — ${message}`);
            } else {
                this.error(`[bundle-guard] ${message}`);
            }
        }

        // --- 2. budget (advisory) ---
        let bytes = 0;
        const gz = (source: string | Uint8Array) =>
            gzipSync(typeof source === "string" ? Buffer.from(source) : Buffer.from(source), {
                level: 9,
            }).length;

        for (const file of [entry[0], ...reachable]) {
            const chunk = byFile.get(file);
            if (chunk) bytes += gz(chunk.code);
        }
        // Stylesheets block first paint too, so they count. Only the entry's
        // own CSS is render-blocking; async chunks' CSS loads with them.
        for (const [file, asset] of Object.entries(bundle)) {
            if (asset.type === "asset" && file.endsWith(".css") && file.includes("/index-")) {
                bytes += gz(asset.source);
            }
        }

        const kb = bytes / 1024;
        const summary = `[bundle-guard] critical path: ${kb.toFixed(1)} kB gzip (budget ${CRITICAL_PATH_BUDGET_KB} kB)`;
        if (kb > CRITICAL_PATH_BUDGET_KB) {
            this.warn(
                `${summary} — OVER BUDGET by ${(kb - CRITICAL_PATH_BUDGET_KB).toFixed(1)} kB. ` +
                    `Not a build failure, but worth a look before merging: check whether a new ` +
                    `dependency landed in the entry chunk that could be lazy instead.`
            );
        } else {
            this.info?.(summary);
        }
    },
});
