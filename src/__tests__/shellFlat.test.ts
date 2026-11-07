/**
 * MIP-1118: the shell is a flat canvas.
 *
 * `commonStyle.ts` is the central definition of the shared surfaces (14
 * frozen objects, 45 files). It still held hand-written gradients, glow
 * decorations and brand-tinted fills that do not flow through the palette;
 * these tests pin that they stay gone.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LayoutStyles } from "../components/ui/styles/commonStyle";
import { purplePalette } from "../theme/purplePalette";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

describe("commonStyle.ts holds no hand-written decoration", () => {
    const code = read("components/ui/styles/commonStyle.ts")
        // Comments may mention what was removed.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

    it("has no gradients and no rgba() literals: colors come from the palette", () => {
        expect(code).not.toMatch(/linear-gradient|radial-gradient/);
        expect(code).not.toMatch(/rgba?\(/);
    });

    it("keeps only the functional online / offline dot colors as hex", () => {
        const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
        expect(hex.sort()).toEqual(["#16a34a", "#22c55e", "#6b7280", "#9ca3af"]);
    });
});

describe("the shell surface", () => {
    for (const mode of ["dark", "light"] as const) {
        it(`${mode}: the service surface is the flat canvas color`, () => {
            const surface = LayoutStyles[mode].serviceSurface as { background: string };
            expect(surface.background).toBe(purplePalette[mode].bg);
        });

        it(`${mode}: the ambient glow decorations are gone`, () => {
            expect(LayoutStyles[mode]).not.toHaveProperty("decorTopRight");
            expect(LayoutStyles[mode]).not.toHaveProperty("decorBottomLeft");
        });
    }
});

describe("the page canvas", () => {
    it("<html> paints the same token Joy's baseline paints on <body>", () => {
        const css = read("index.css").replace(/\s+/g, " ");
        expect(css).toContain("background-color: var(--g-bg, var(--color-background));");
    });
});
