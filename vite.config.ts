import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
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
                    if (!id.includes("node_modules")) return undefined;
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
            plugins: process.env.CI
                ? []
                : [visualizer({ filename: "stats.html", open: true })],
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
