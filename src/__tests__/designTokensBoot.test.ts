/**
 * MIP-1118: the design tokens are live in the app, and Geist is the one
 * typeface. Several independent things each have to say "Geist": the CSS
 * that runs before any script, Joy, and BlockNote's own stylesheet. Each is
 * easy to miss, and a miss shows up as a second typeface on one screen, so
 * each is pinned. (The task table and board used to carry a Material provider
 * of their own, a third place to say "Geist"; MIP-1121 removed it, and the
 * last test below keeps it from coming back.)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildJoyTheme } from "../theme/purplePalette";
import { FONT_STACKS } from "../theme/tokens/scales";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8").replace(/\s+/g, " ");

describe("Geist is the app typeface", () => {
    it("index.css repeats the token stack exactly (it must resolve before any script)", () => {
        expect(source("index.css")).toContain(`--font-family: ${FONT_STACKS.geist};`);
    });

    it("loads the font files at boot", () => {
        expect(source("main.tsx")).toContain('import "@fontsource-variable/geist/index.css";');
    });

    it("Joy's body, display and code families come from the tokens", () => {
        const { fontFamily } = buildJoyTheme("purple") as unknown as {
            fontFamily: Record<string, string>;
        };
        expect(fontFamily.body).toBe(FONT_STACKS.geist);
        expect(fontFamily.display).toBe(FONT_STACKS.geist);
        expect(fontFamily.code).toBe(FONT_STACKS.mono);
    });

    it("BlockNote's own Inter is overridden with enough specificity to win", () => {
        const css = source("App.css");
        expect(css).toContain("html .bn-root { --bn-font-family: var(--g-font-body); }");
        expect(css).toContain("html .bn-default-styles { font-family: var(--g-font-body); }");
    });

    it.each([
        "features/tasks/components/table/DraggableTaskTable.tsx",
        "features/tasks/components/board/SprintBoard.tsx",
    ])("%s has no Material provider (it would bring Roboto back)", (file) => {
        expect(source(file)).not.toContain("@mui/material");
        expect(source(file)).not.toContain("createTheme");
    });
});

describe("the design tokens install at boot", () => {
    it("importing the theme provider installs the token stylesheet, Geist included", async () => {
        // Vitest gives each test file a fresh module registry and document,
        // so nothing has installed the stylesheet before this import.
        expect(document.getElementById("genos-design-tokens")).toBeNull();
        await import("../theme/ColorThemeProvider");
        const style = document.getElementById("genos-design-tokens");
        expect(style).not.toBeNull();
        expect(style!.textContent).toContain(`--g-font-body: ${FONT_STACKS.geist};`);
    });
});
