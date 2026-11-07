/**
 * MIP-1118: the Joy palettes, built from the design roles, are readable in
 * every theme and mode.
 *
 * `designTokens.test.ts` checks the ROLES. That is not enough: what a Joy
 * component shows is decided by which role Joy's palette points at. The
 * case that motivated this file: Joy colors `body-sm` and `body-xs` (about
 * 1,050 uses) with `text.tertiary`, and the tertiary ROLE is only held to
 * 3:1. This test reads the values Joy really resolves and holds every text
 * pairing to WCAG AA, so a re-pointed palette can't quietly drop content
 * below it.
 */

import { describe, expect, it } from "vitest";

import { buildJoyTheme } from "../theme/purplePalette";
import { THEME_IDS } from "../theme/themePalettes";
import { composite, contrast } from "../theme/tokens/color";
import { joyComponents } from "../theme/tokens/joyComponents";
import { alphaCss, buildRoles, Mode } from "../theme/tokens/roles";

const AA = 4.5;
const NON_TEXT = 3;

type Palette = Record<string, Record<string, string> & string>;
type Theme = { colorSchemes: Record<Mode, { palette: Palette }> };

/** "#rrggbb" or "rgba(r, g, b, a)" → opaque color painted over `backdrop`. */
const resolve = (value: string, backdrop: string): string => {
    if (value.startsWith("#")) return value;
    const m = value.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (!m) throw new Error(`Joy palette value is not a real color: ${value}`);
    const hex =
        "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    return composite(hex, m[4] === undefined ? 1 : Number(m[4]), backdrop);
};

const cases = THEME_IDS.flatMap((id) =>
    (["light", "dark"] as Mode[]).map((m) => [id, m] as const)
);

describe.each(cases)("Joy palette: %s / %s", (id, mode) => {
    const p = (buildJoyTheme(id) as unknown as Theme).colorSchemes[mode].palette;
    const bg = p.background as unknown as Record<string, string>;
    const text = p.text as unknown as Record<string, string>;
    const surfaces = ["body", "surface", "popup", "level1", "level2"].map((k) =>
        resolve(bg[k], bg.body)
    );
    const [body, surface] = surfaces;

    const readable = (fg: string, backdrops: string[], min = AA) =>
        backdrops
            .map((b) => ({ b, ratio: Math.round(contrast(resolve(fg, b), b) * 100) / 100 }))
            .filter((x) => x.ratio < min);

    it("text.primary / secondary / tertiary pass AA on every Joy surface", () => {
        // `tertiary` is what body-sm and body-xs (about 1,050 uses) read.
        for (const k of ["primary", "secondary", "tertiary"]) {
            expect(readable(text[k], surfaces), `text.${k}`).toEqual([]);
        }
    });

    it("tertiary is the AA role, not the 3:1 meta role", () => {
        const roles = buildRoles(id, mode);
        expect(text.tertiary).toBe(roles.textSecondary);
        expect(text.tertiary).not.toBe(roles.textTertiary);
    });

    it("icons and the focus ring pass 3:1", () => {
        expect(readable(text.icon, [body, surface], NON_TEXT)).toEqual([]);
        expect(readable(p.focusVisible as unknown as string, surfaces, NON_TEXT)).toEqual([]);
    });

    it("primary: solid, soft, plain and outlined variants pass AA", () => {
        const v = p.primary;
        for (const k of ["solidBg", "solidHoverBg", "solidActiveBg"]) {
            expect(contrast(v.solidColor, resolve(v[k], body)), k).toBeGreaterThanOrEqual(AA);
        }
        for (const bgk of ["softBg", "softHoverBg", "softActiveBg"]) {
            for (const s of [body, surface]) {
                const under = resolve(v[bgk], s);
                expect(contrast(v.softColor, under), `${bgk} on ${s}`).toBeGreaterThanOrEqual(AA);
            }
        }
        for (const bgk of ["plainHoverBg", "plainActiveBg", "outlinedHoverBg"]) {
            for (const s of [body, surface]) {
                const under = resolve(v[bgk], s);
                const fg = bgk.startsWith("plain") ? v.plainColor : v.outlinedColor;
                expect(contrast(fg, under), `${bgk} on ${s}`).toBeGreaterThanOrEqual(AA);
            }
        }
        expect(readable(v.plainColor, [body, surface])).toEqual([]);
        expect(readable(v.outlinedColor, [body, surface])).toEqual([]);
    });

    it("neutral: tooltip-style solid, soft, plain and outlined pass AA", () => {
        const v = p.neutral;
        for (const k of ["solidBg", "solidHoverBg", "solidActiveBg"]) {
            expect(contrast(v.solidColor, resolve(v[k], body)), k).toBeGreaterThanOrEqual(AA);
        }
        for (const s of [body, surface]) {
            for (const bgk of ["softBg", "softHoverBg", "softActiveBg"]) {
                const under = resolve(v[bgk], s);
                expect(contrast(v.softColor, under), `${bgk} on ${s}`).toBeGreaterThanOrEqual(AA);
            }
            for (const bgk of ["plainHoverBg", "plainActiveBg"]) {
                const under = resolve(v[bgk], s);
                expect(contrast(v.plainColor, under), `${bgk} on ${s}`).toBeGreaterThanOrEqual(AA);
            }
        }
    });

    it("neutral solid is a mid-tone fill with white on it in BOTH modes (Switch track, tooltip)", () => {
        // A light fill in dark mode left a white Switch thumb almost invisible.
        const v = p.neutral;
        for (const k of ["solidBg", "solidHoverBg", "solidActiveBg"]) {
            const fill = resolve(v[k], body);
            expect(v.solidColor, k).toBe("#ffffff");
            expect(contrast("#ffffff", fill), `white on ${k}`).toBeGreaterThanOrEqual(AA);
        }
        // ...and the track itself has to be findable on the page.
        expect(contrast(resolve(v.solidBg, body), body), "track on page").toBeGreaterThanOrEqual(
            NON_TEXT
        );
        expect(resolve(bg.tooltip, body)).toBe(resolve(v.solidBg, body));
    });

    it("control borders are at least as findable as Joy's old default (about 1.46:1)", () => {
        // Input, Select, Textarea and Checkbox draw their boundary with
        // neutral.outlinedBorder. The card hairline (0.11) was too faint.
        const border = resolve(p.neutral.outlinedBorder, surface);
        expect(contrast(border, surface)).toBeGreaterThanOrEqual(1.4);
        expect(p.neutral.outlinedBorder).toBe(alphaCss(buildRoles(id, mode).borderStrong));
    });

    it.each(["danger", "success", "warning"])("%s: fill and text variants pass AA", (k) => {
        const v = p[k];
        for (const bgk of ["solidBg", "solidHoverBg", "solidActiveBg"]) {
            expect(contrast(v.solidColor, resolve(v[bgk], body)), bgk).toBeGreaterThanOrEqual(AA);
        }
        for (const s of [body, surface]) {
            for (const bgk of ["softBg", "softHoverBg", "softActiveBg"]) {
                const under = resolve(v[bgk], s);
                expect(contrast(v.softColor, under), `${bgk} on ${s}`).toBeGreaterThanOrEqual(AA);
            }
        }
        expect(readable(v.plainColor, [body, surface])).toEqual([]);
    });

    it("soft fills are opaque, so a Joy avatar, chip or checkbox stays visible on any surface", () => {
        // Joy's soft variants are opaque. Translucent ones vanished on the
        // hard-coded dark Create Project modal inside a light page.
        for (const k of ["primary", "neutral", "danger", "success", "warning"]) {
            for (const state of ["softBg", "softHoverBg", "softActiveBg"]) {
                expect(p[k][state], `${k}.${state}`).toMatch(/^#[0-9a-f]{6}$/i);
            }
        }
    });

    it("the primary palette is flat: the gradient is not in it", () => {
        for (const value of Object.values(p.primary)) {
            expect(String(value)).not.toContain("gradient");
        }
    });
});

describe("Joy palette identity", () => {
    it("purple's accent is still #7c3aed in both modes", () => {
        for (const mode of ["light", "dark"] as Mode[]) {
            const p = (buildJoyTheme("purple") as unknown as Theme).colorSchemes[mode].palette;
            expect(p.primary.solidBg).toBe("#7c3aed");
        }
    });

    it("status palettes are the same on every theme", () => {
        for (const mode of ["light", "dark"] as Mode[]) {
            const ref = (buildJoyTheme("purple") as unknown as Theme).colorSchemes[mode].palette;
            for (const id of THEME_IDS) {
                const p = (buildJoyTheme(id) as unknown as Theme).colorSchemes[mode].palette;
                for (const k of ["danger", "success", "warning"]) {
                    expect(p[k].solidBg, `${id}/${mode}/${k}`).toBe(ref[k].solidBg);
                    expect(p[k].softColor, `${id}/${mode}/${k}`).toBe(ref[k].softColor);
                }
            }
        }
    });
});

describe("Joy Button: the only gradient left", () => {
    const root = joyComponents.JoyButton.styleOverrides.root;

    it("a primary solid button gets the brand gradient, and hover/active get its pair", () => {
        const style = root({ ownerState: { variant: "solid", color: "primary" } }) as Record<
            string,
            unknown
        >;
        expect(style.background).toBe("var(--g-brand-gradient)");
        // Hover and pressed only while ENABLED: a disabled or loading button
        // must not light up (its `.Mui-disabled` rule is as specific as :hover).
        const enabled = "&:not(.Mui-disabled):not(.MuiButton-loading)";
        expect(style[`${enabled}:hover, ${enabled}:active`]).toEqual({
            background: "var(--g-brand-gradient-hover)",
        });
        expect(style["&:hover, &:active"]).toBeUndefined();
    });

    it.each([
        ["solid", "neutral"],
        ["solid", "danger"],
        ["outlined", "primary"],
        ["soft", "primary"],
        ["plain", "primary"],
    ])("a %s %s button stays flat", (variant, color) => {
        const style = root({ ownerState: { variant, color } }) as Record<string, unknown>;
        expect(style.background).toBeUndefined();
    });

    it("moves named properties only (never transition: all) and honors reduced motion", () => {
        const style = root({ ownerState: {} }) as Record<string, unknown>;
        expect(String(style.transitionProperty)).not.toContain("all");
        expect(style["@media (prefers-reduced-motion: reduce)"]).toEqual({ transition: "none" });
    });
});
