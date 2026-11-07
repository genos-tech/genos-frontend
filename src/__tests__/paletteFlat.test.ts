/**
 * MIP-1118: the `--gp-*` palette is flat.
 *
 * Ken's decision (2026-11-07): solid surfaces and thin borders; the
 * gradient survives only on the primary button and brand moments. The
 * palette feeds about 60 files and every frozen object in commonStyle.ts,
 * so this is where that decision actually reaches the screen, and where it
 * would quietly come back if someone re-adds a gradient to a token.
 */

import { describe, expect, it } from "vitest";

import { purplePalette } from "../theme/purplePalette";

const MODES = ["dark", "light"] as const;
type Tokens = Record<string, string>;
const tokens = (mode: (typeof MODES)[number]) => purplePalette[mode] as unknown as Tokens;

/** The only tokens allowed to be gradients: the brand button's. */
const BRAND_GRADIENTS = [
    "accentGradient",
    "accentGradientHover",
    "primaryButtonBg",
    "primaryButtonHover",
];

describe.each(MODES)("palette (%s) is flat", (mode) => {
    const t = tokens(mode);

    it("only the brand button tokens are gradients", () => {
        const gradients = Object.entries(t)
            .filter(([, v]) => v.includes("gradient"))
            .map(([k]) => k)
            .sort();
        expect(gradients).toEqual([...BRAND_GRADIENTS].sort());
    });

    it("titles are plain text color, valid for the `background:` shorthand they are used in", () => {
        expect(t.titleGradient).toBe(t.text);
        expect(t.titleGradient).toBe(`var(--gp-${mode}-text)`);
    });

    it("surfaces are one solid color, not translucent", () => {
        for (const k of ["surface", "surfaceElevated", "surfaceSolid", "inputBg", "menuBg"]) {
            expect(t[k], k).toMatch(/^rgb\(var\(--gp-(dark|light)-[a-z-]+-rgb\)\)$/);
        }
    });

    it("lines, fills, chips, buttons, menus and depth are neutral, not brand-tinted", () => {
        const neutral = [
            "border",
            "borderStrong",
            "borderMuted",
            "divider",
            "hoverBg",
            "activeBg",
            "chipBg",
            "chipBorder",
            "buttonBg",
            "buttonBgHover",
            "buttonBorder",
            "menuBg",
            "menuBorder",
            "inputBorder",
            "shadow",
            "shadowSoft",
            "glow",
            "primaryButtonShadow",
        ];
        for (const k of neutral) {
            expect(t[k], k).not.toContain("--gp-brand");
            expect(t[k], k).not.toContain("brand-rgb");
        }
    });

    it("muted and subtle text are opaque (they carried 0.9 and 0.7 alpha nothing measured)", () => {
        expect(t.textMuted).toMatch(/^rgb\(/);
        expect(t.textSubtle).toMatch(/^rgb\(/);
    });

    it("status tints are flat translucent fills of one hue", () => {
        for (const k of ["dangerTintBg", "dangerTintBgHover", "successTintBg", "warningTintBg"]) {
            expect(t[k], k).toMatch(/^rgba\(var\(--gp-(dark|light)-[a-z]+-tint-rgb\), [\d.]+\)$/);
        }
    });

    it("the accent family is unchanged (the brand ramp is not part of the flattening)", () => {
        expect(t.accent).toBe(`var(--gp-${mode}-accent)`);
        expect(t.accentStrong).toBe(`var(--gp-${mode}-accent-strong)`);
        expect(t.accentSoft).toBe(`var(--gp-${mode}-accent-soft)`);
    });
});
