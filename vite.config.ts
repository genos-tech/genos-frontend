import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        strictPort: true,
    },
    build: {
        sourcemap: true,
        chunkSizeWarningLimit: 5000, // in kB, default is 500
        rollupOptions: {
            plugins: [
                visualizer({
                    filename: "stats.html",
                    open: true, // opens in browser after build
                }),
            ],
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/__tests__/setup.ts"],
    },
});
