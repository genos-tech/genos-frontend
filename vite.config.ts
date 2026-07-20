import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

import { bundleGuard } from "./scripts/bundleGuard";

// https://vite.dev/config/
export default defineConfig({
    // `bundleGuard` is build-only (it no-ops in dev/test) and fails the build
    // if a chunk that must stay lazy becomes statically reachable from the
    // entry. See scripts/bundleGuard.ts for why that check earns a hard
    // failure while the size budget is only a warning.
    plugins: [react(), tailwindcss(), bundleGuard()],
    server: {
        port: 3000,
        strictPort: true,
    },
    build: {
        sourcemap: true,
        chunkSizeWarningLimit: 5000, // in kB, default is 500
        rollupOptions: {
            output: {
                // Split heavy vendor deps into named chunks so they
                // (1) load in parallel with the app code, (2) survive
                // cache eviction independently from app-code changes,
                // and (3) don't end up duplicated into multiple async
                // chunks via Rollup's shared-module dedup. Adjust this
                // list if you add a new heavy dep — the rule is "any
                // single dep tree >50 kB minified is worth pinning".
                manualChunks: (id) => {
                    // Vite's virtual runtime helpers (the dynamic-import
                    // preload helper, modulepreload polyfill) are imported
                    // by every chunk that lazy-loads anything. If Rollup
                    // co-locates them inside a big vendor chunk — it chose
                    // vendor-editor — every other chunk (including the
                    // entry) statically depends on that chunk just to
                    // reach a 1 kB helper. Pin them to a micro-chunk.
                    if (id.startsWith("\0vite/") || id.includes("vite/preload-helper")) {
                        return "vite-runtime";
                    }
                    if (!id.includes("node_modules")) return undefined;
                    // Pin the React runtime to its own chunk. Without
                    // this, Rollup is free to co-locate react-dom +
                    // scheduler inside whichever vendor chunk it
                    // groups first — it chose vendor-editor, which
                    // made EVERY chunk (including the entry) statically
                    // depend on the ~900 kB gzipped editor chunk just
                    // to reach ReactDOM. That single edge kept the
                    // editor stack in the critical path of the signin
                    // page. Match on "node_modules/react/" (with both
                    // slashes) so react-router / @floating-ui/react /
                    // react-icons don't get dragged in.
                    if (
                        id.includes("node_modules/react/") ||
                        id.includes("node_modules/react-dom/") ||
                        id.includes("node_modules/scheduler/") ||
                        id.includes("node_modules/use-sync-external-store/")
                    ) {
                        return "vendor-react";
                    }
                    // The unified/remark/micromark markdown constellation
                    // is shared by react-markdown (Spotlight answers —
                    // eager) and BlockNote's markdown import/export (lazy
                    // editor chunk). Left unpinned, Rollup co-locates it
                    // inside vendor-editor, which makes the ENTRY chunk
                    // statically depend on the editor chunk to reach the
                    // shared modules — putting ~900 kB gzipped of editor
                    // code back into the signin critical path.
                    if (
                        /node_modules\/(react-markdown|micromark[^/]*|mdast-util-[^/]*|remark-[^/]*|rehype-[^/]*|hast-util-[^/]*|hastscript|unified|unist-util-[^/]*|vfile[^/]*|parse5|property-information|space-separated-tokens|comma-separated-tokens|character-entities[^/]*|decode-named-character-reference|stringify-entities|zwitch|bail|trough|devlop|longest-streak|markdown-table|ccount|escape-string-regexp|trim-lines|trim-trailing-lines|web-namespaces|html-void-elements|is-plain-obj|extend|entities|style-to-object|inline-style-parser|estree-util-is-identifier-name|html-url-attributes)\//.test(
                            id
                        ) ||
                        id.includes("@ungap/structured-clone")
                    ) {
                        return "vendor-markdown";
                    }
                    // BlockNote, Yjs, Hocuspocus, and Shiki all interlock —
                    // Shiki is used by BlockNote's code block, Hocuspocus is
                    // the collab provider for Yjs. Splitting them into
                    // separate vendor chunks produced "Circular chunk"
                    // warnings, which Rollup honors but which risk
                    // module-init-order bugs. Keep them together.
                    if (
                        id.includes("@blocknote") ||
                        id.includes("/yjs/") ||
                        id.includes("/y-") ||
                        id.includes("@hocuspocus") ||
                        id.includes("shiki") ||
                        id.includes("@shikijs")
                    ) {
                        return "vendor-editor";
                    }
                    if (id.includes("emoji-mart") || id.includes("@emoji-mart")) {
                        return "vendor-emoji";
                    }
                    // @hello-pangea/dnd is the drag-and-drop library used by
                    // the task table and sprint board. Splitting it out
                    // keeps the table/board feature chunks lean.
                    if (id.includes("@hello-pangea/dnd")) {
                        return "vendor-dnd";
                    }
                    if (id.includes("@mui/icons-material")) {
                        return "vendor-mui-icons";
                    }
                    if (id.includes("@mui") || id.includes("@emotion")) {
                        return "vendor-mui";
                    }
                    return undefined;
                },
            },
            // The bundle visualizer builds a full-module treemap during chunk
            // generation — memory-heavy on a 6k-module app and a dev-only
            // analysis tool. Skip it entirely in CI (it contributed to the
            // GitHub Actions heap OOM); keep it for local builds.
            plugins: process.env.CI ? [] : [visualizer({ filename: "stats.html", open: true })],
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/__tests__/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "lcov"],
            // Collect-and-report only (no thresholds at baseline). Scope to
            // the targeted, testable layers; ratchet per-glob thresholds in
            // later once a green coverage baseline lands.
            include: [
                "src/services/**",
                "src/db/repositories/**",
                "src/db/services/**",
                "src/db/utils/**",
                "src/utils/**",
                "src/hooks/**",
                "src/context/**",
            ],
            exclude: [
                "src/__tests__/**",
                "src/types/**",
                "src/i18n/**",
                "src/lp/**",
                "src/theme/**",
                "src/assets/**",
                "src/main.tsx",
                "src/App.tsx",
                "src/db/workers/*Worker.ts",
                "**/*.d.ts",
            ],
        },
    },
});
