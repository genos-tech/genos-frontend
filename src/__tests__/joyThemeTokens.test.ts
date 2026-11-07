/**
 * MIP-1118: the Joy theme is built from the design tokens, not from Joy's
 * defaults. These tests pin what Joy resolves, since a Joy `level="body-sm"`
 * at a call site says nothing about how big that is.
 */

import { describe, expect, it } from "vitest";

import { buildJoyTheme } from "../theme/purplePalette";
import { RADIUS, TYPE_SCALE } from "../theme/tokens/scales";

type Level = { fontSize: string; lineHeight: number; fontWeight: number; color: string };
const theme = buildJoyTheme("purple") as unknown as {
    typography: Record<string, Level>;
    fontWeight: Record<string, number>;
    fontSize: Record<string, string>;
    radius: Record<string, string>;
    shadow: Record<string, string>;
};

const LEVELS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "title-lg",
    "title-md",
    "title-sm",
    "body-lg",
    "body-md",
    "body-sm",
    "body-xs",
] as const;

describe("Joy type levels come from the token scale", () => {
    it.each(LEVELS)("%s: size, proportional line height and weight", (name) => {
        const token = TYPE_SCALE[name];
        const joy = theme.typography[name];
        expect(joy.fontSize).toBe(`${token.size / 16}rem`);
        // Unitless, so an `sx` fontSize override still gets a proportional box.
        expect(joy.lineHeight).toBeGreaterThan(1);
        expect(joy.lineHeight).toBeLessThan(2);
        expect(joy.lineHeight * token.size).toBeCloseTo(token.line, 1);
        expect(joy.fontWeight).toBe(token.weight);
    });

    it("body-sm is 13px and body-md 14px (they were 14px and 16px)", () => {
        expect(theme.typography["body-sm"].fontSize).toBe("0.8125rem");
        expect(theme.typography["body-md"].fontSize).toBe("0.875rem");
    });

    it("keeps Joy's per-level text color (body-sm and body-xs read text.tertiary)", () => {
        expect(theme.typography["body-sm"].color).toContain("--joy-palette-text-tertiary");
        expect(theme.typography["body-xs"].color).toContain("--joy-palette-text-tertiary");
        expect(theme.typography.h3.color).toContain("--joy-palette-text-primary");
    });

    it("uses only the three weights, 400 / 500 / 600", () => {
        const used = new Set([
            ...LEVELS.map((n) => theme.typography[n].fontWeight),
            ...Object.values(theme.fontWeight),
        ]);
        expect([...used].sort()).toEqual([400, 500, 600]);
    });
});

describe("Joy's own font-size scale agrees with the levels", () => {
    // Button, Chip and Checkbox size their text from fontSize.sm / md, not from
    // the type levels; left alone they sat 1px larger than the text beside them.
    it("sm and md are the body-sm and body-md sizes", () => {
        expect(theme.fontSize.sm).toBe(theme.typography["body-sm"].fontSize);
        expect(theme.fontSize.md).toBe(theme.typography["body-md"].fontSize);
    });

    it("xs, lg, xl and up stay Joy's: xl / xl2 also size icon and decorator glyphs", () => {
        expect(theme.fontSize.xs).toBe("0.75rem");
        expect(theme.fontSize.lg).toBe("1.125rem");
        expect(theme.fontSize.xl).toBe("1.25rem");
        expect(theme.fontSize.xl2).toBe("1.5rem");
    });
});

describe("Joy radius and shadow come from the tokens", () => {
    it("radius scale matches the token steps (xl stays Joy's 16px for modals)", () => {
        expect(theme.radius).toEqual({
            xs: `${RADIUS.xs}px`,
            sm: `${RADIUS.sm}px`,
            md: `${RADIUS.md}px`,
            lg: `${RADIUS.lg}px`,
            xl: "16px",
        });
    });

    it("shadows read the mode-resolved --g-shadow-* variables, so one theme serves both modes", () => {
        expect(theme.shadow.sm).toBe("var(--g-shadow-sm)");
        expect(theme.shadow.md).toBe("var(--g-shadow-md)");
        expect(theme.shadow.lg).toBe("var(--g-shadow-lg)");
        expect(Object.values(theme.shadow).every((v) => v.startsWith("var(--g-shadow-"))).toBe(
            true
        );
    });
});
