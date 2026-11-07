/**
 * Design tokens (MIP-1106): every theme × mode must be readable.
 *
 * Seven themes × two modes is too many to check by screenshot, so the
 * guarantee lives here. Each text-like role is measured against every
 * surface it can sit on, and translucent roles (hover fills, selected
 * tints) are composited over those surfaces first, because that is what
 * actually renders. Thresholds are WCAG 2.2: 4.5:1 for text, 3:1 for the
 * focus ring and for tertiary meta text (which never carries the only
 * copy of anything).
 */

import { describe, expect, it } from "vitest";

import { THEME_IDS } from "../theme/themePalettes";
import { composite, contrast, hexToOklch, oklchToHex } from "../theme/tokens/color";
import { buildRoles, Mode, RoleColors } from "../theme/tokens/roles";
import { buildTokenStylesheet, MODES, roleVars } from "../theme/tokens/tokenStyles";

const AA = 4.5;
const NON_TEXT = 3;

const surfacesOf = (r: RoleColors) => ({
    bg: r.bg,
    bgSubtle: r.bgSubtle,
    surface: r.surface,
    surfaceRaised: r.surfaceRaised,
});

/** Surfaces plus the same surfaces under a hover fill: a row's text has
 *  to stay readable while the row is hovered. */
const textBackdrops = (r: RoleColors): Record<string, string> => {
    const s = surfacesOf(r);
    const hovered = Object.fromEntries(
        Object.entries(s).map(([k, c]) => [`${k}+hover`, composite(r.hover.hex, r.hover.a, c)])
    );
    return { ...s, ...hovered };
};

const failures = (fg: string, backdrops: Record<string, string>, min: number) =>
    Object.entries(backdrops)
        .map(([name, bg]) => ({ name, ratio: Math.round(contrast(fg, bg) * 100) / 100 }))
        .filter((x) => x.ratio < min);

const cases = THEME_IDS.flatMap((id) => MODES.map((mode) => [id, mode] as [string, Mode]));

describe("OKLCH conversion", () => {
    it("round-trips sRGB within one channel step", () => {
        for (const hex of ["#7c3aed", "#0f766e", "#f59e0b", "#111114", "#ffffff", "#334155"]) {
            const { l, c, h } = hexToOklch(hex);
            const back = oklchToHex(l, c, h);
            const diff = [1, 3, 5].map((i) =>
                Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16))
            );
            expect(Math.max(...diff), `${hex} → ${back}`).toBeLessThanOrEqual(1);
        }
    });
});

describe.each(cases)("%s / %s", (id, mode) => {
    const r = buildRoles(id as never, mode);
    const backdrops = textBackdrops(r);
    const selected = Object.fromEntries(
        Object.entries(surfacesOf(r)).map(([k, c]) => [
            `${k}+selected`,
            composite(r.accentSubtle.hex, r.accentSubtle.a, c),
        ])
    );

    it("primary and secondary text pass AA on every surface", () => {
        expect(failures(r.text, backdrops, AA)).toEqual([]);
        expect(failures(r.textSecondary, backdrops, AA)).toEqual([]);
    });

    it("tertiary text passes 3:1 on every surface", () => {
        expect(failures(r.textTertiary, backdrops, NON_TEXT)).toEqual([]);
    });

    it("text on the accent passes AA, including both gradients", () => {
        const fills = Object.fromEntries(
            [r.accent, r.accentHover, ...r.brandGradientStops].map((c, i) => [`fill${i}`, c])
        );
        expect(failures(r.accentFg, fills, AA)).toEqual([]);
    });

    it("accent text passes AA on surfaces and on its own selected tint", () => {
        expect(failures(r.accentText, { ...surfacesOf(r), ...selected }, AA)).toEqual([]);
    });

    it("focus ring passes 3:1 on every surface", () => {
        expect(failures(r.focus, surfacesOf(r), NON_TEXT)).toEqual([]);
    });

    it.each(["danger", "success", "warning", "info"] as const)(
        "%s reads as text and as a fill",
        (k) => {
            const s = r[k];
            const tinted = Object.fromEntries(
                Object.entries(surfacesOf(r)).map(([n, c]) => [
                    `${n}+tint`,
                    composite(s.subtle.hex, s.subtle.a, c),
                ])
            );
            expect(failures(s.text, { ...surfacesOf(r), ...tinted }, AA)).toEqual([]);
            expect(contrast(s.solidFg, s.solid)).toBeGreaterThanOrEqual(AA);
        }
    );
});

describe("theme identity", () => {
    it("purple keeps #7c3aed as its accent in both modes", () => {
        expect(buildRoles("purple", "light").accent).toBe("#7c3aed");
        expect(buildRoles("purple", "dark").accent).toBe("#7c3aed");
    });

    it("semantic colors are the same on every theme (real red/green/amber)", () => {
        for (const mode of MODES) {
            const ref = buildRoles("purple", mode);
            for (const id of THEME_IDS) {
                const r = buildRoles(id, mode);
                expect(r.danger, `${id}/${mode}`).toEqual(ref.danger);
                expect(r.success, `${id}/${mode}`).toEqual(ref.success);
                expect(r.warning, `${id}/${mode}`).toEqual(ref.warning);
                expect(r.info, `${id}/${mode}`).toEqual(ref.info);
            }
        }
    });
});

describe("token stylesheet", () => {
    const css = buildTokenStylesheet();
    const expected = roleVars(buildRoles("purple", "light")).map(([k]) => `--g-${k}`);

    it("defines every role in every theme × mode block", () => {
        for (const id of THEME_IDS) {
            for (const mode of MODES) {
                const sel = `[data-g-theme="${id}"][data-g-mode="${mode}"]`;
                const start = css.indexOf(sel);
                expect(start, sel).toBeGreaterThan(-1);
                const body = css.slice(start, css.indexOf("}", start));
                for (const name of expected) expect(body, `${sel} ${name}`).toContain(`${name}:`);
            }
        }
    });

    it("resolves without data-theme (purple fallback on bare :root)", () => {
        expect(css).toMatch(/^:root,\n:root\[data-joy-color-scheme="light"\]/m);
        expect(css).toMatch(/^:root\[data-joy-color-scheme="dark"\],/m);
    });
});
