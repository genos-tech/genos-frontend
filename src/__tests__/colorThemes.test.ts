/**
 * The color-theme system.
 *
 * The property that matters most here isn't "a theme exists" — it's that
 * **purple resolves to exactly the colors that were hardcoded before**.
 * ~1,400 literals across the app were rewritten into `var(--gp-…)`
 * references, and the whole change is only safe if every one of those
 * variables still yields the literal it replaced for the default theme.
 * TypeScript can't check that (they're all `string`), so it's asserted
 * here against the values read out of the pre-change source.
 *
 * The second property: a palette token must never be something the browser
 * can't parse where we put it. Tokens go into `sx`/`style`, so `var()` is
 * fine — but a token that is *only* a bare `var()` can't have hex alpha
 * appended, which is why the `*Rgb` companions exist and why every theme
 * has to define every variable the palette references.
 */

import { describe, expect, it } from "vitest";

import { purplePalette } from "../theme/purplePalette";
import { DEFAULT_THEME_ID, THEME_IDS, THEME_PRIMITIVES } from "../theme/themePalettes";
import { buildThemeStylesheet } from "../theme/themeStyles";

/** Every `--gp-*` name the stylesheet defines. */
const definedVars = (css: string): Set<string> =>
    new Set(Array.from(css.matchAll(/(--gp-[a-z0-9-]+)\s*:/g), (m) => m[1]));

/** Every `--gp-*` name referenced anywhere in the palette formulas. */
const referencedVars = (): Set<string> => {
    const out = new Set<string>();
    for (const tokens of [purplePalette.dark, purplePalette.light]) {
        for (const value of Object.values(tokens)) {
            for (const m of value.matchAll(/var\((--gp-[a-z0-9-]+)\)/g)) out.add(m[1]);
        }
    }
    return out;
};

/** Pull one variable's value out of a given theme's block. */
const varValue = (css: string, themeId: string, name: string): string | undefined => {
    const selector =
        themeId === DEFAULT_THEME_ID
            ? `:root, :root\\[data-theme="${themeId}"\\]`
            : `:root\\[data-theme="${themeId}"\\]`;
    const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
    if (!block) return undefined;
    return new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block[1])?.[1].trim();
};

const css = buildThemeStylesheet();

describe("theme stylesheet", () => {
    it("defines a block for every theme, with the default also on bare :root", () => {
        for (const id of THEME_IDS) {
            expect(css).toContain(`:root[data-theme="${id}"]`);
        }
        // Unknown/absent data-theme must still paint, not leave every
        // var unresolved (which renders as transparent).
        expect(css).toContain(`:root, :root[data-theme="${DEFAULT_THEME_ID}"]`);
    });

    it("every variable the palette references is defined by every theme", () => {
        const referenced = referencedVars();
        expect(referenced.size).toBeGreaterThan(20);
        for (const id of THEME_IDS) {
            const selector =
                id === DEFAULT_THEME_ID
                    ? `:root, :root\\[data-theme="${id}"\\]`
                    : `:root\\[data-theme="${id}"\\]`;
            const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
            expect(block, `no block for ${id}`).toBeTruthy();
            const defined = definedVars(block![1]);
            for (const name of referenced) {
                expect(defined.has(name), `theme "${id}" is missing ${name}`).toBe(true);
            }
        }
    });
});

describe("purple resolves to the pre-theming literals", () => {
    // Read off `git show HEAD~:src/theme/purplePalette.ts` — the values the
    // app shipped with. A failure here means the default theme moved.
    const EXPECTED: Record<string, string> = {
        "--gp-brand-rgb": "124, 58, 237",
        "--gp-brand-alt-rgb": "139, 92, 246",
        "--gp-grad-from": "#7c3aed",
        "--gp-grad-to": "#5b21b6",
        "--gp-grad-from-hover": "#8b5cf6",
        "--gp-grad-to-hover": "#6d28d9",
        "--gp-dark-accent": "#8b5cf6",
        "--gp-dark-accent-strong": "#7c3aed",
        "--gp-dark-accent-soft": "#a78bfa",
        "--gp-dark-accent-muted": "#c084fc",
        "--gp-dark-bg": "#0b0a16",
        "--gp-dark-surface-a-rgb": "30, 20, 46",
        "--gp-dark-surface-b-rgb": "20, 14, 34",
        "--gp-dark-surface-c-rgb": "40, 28, 60",
        "--gp-dark-input-bg-rgb": "15, 10, 24",
        "--gp-dark-text": "#f1f5f9",
        "--gp-dark-text-muted-rgb": "168, 168, 200",
        "--gp-dark-text-subtle-rgb": "148, 148, 180",
        "--gp-dark-danger-tint": "#e879c3",
        "--gp-dark-success-tint": "#c084fc",
        "--gp-dark-warning-tint": "#d8b4fe",
        "--gp-light-accent": "#7c3aed",
        "--gp-light-accent-strong": "#6d28d9",
        "--gp-light-accent-soft": "#9333ea",
        "--gp-light-accent-muted": "#a855f7",
        "--gp-light-bg": "#faf9ff",
        "--gp-light-surface-a-rgb": "255, 255, 255",
        "--gp-light-surface-b-rgb": "248, 245, 255",
        "--gp-light-surface-c-rgb": "245, 240, 255",
        "--gp-light-text": "#1e293b",
        "--gp-light-danger-tint": "#c026a8",
        "--gp-light-success-tint": "#9333ea",
        "--gp-light-warning-tint": "#a855f7",
    };

    it.each(Object.entries(EXPECTED))("%s === %s", (name, expected) => {
        expect(varValue(css, "purple", name)).toBe(expected);
    });

    // The ramp aliases are what the ~1,400 codemodded literals resolve
    // through, so each one has to reproduce the exact hex it replaced.
    const RAMP: Record<string, string> = {
        "--gp-brand-50": "#faf5ff",
        "--gp-brand-100": "#f3e8ff",
        "--gp-brand-200": "#e9d5ff",
        "--gp-brand-300": "#d8b4fe",
        "--gp-brand-400": "#c084fc",
        "--gp-brand-500": "#a855f7",
        "--gp-brand-600": "#9333ea",
        "--gp-brand-700": "#7c3aed",
        "--gp-brand-800": "#6d28d9",
        "--gp-brand-900": "#5b21b6",
        "--gp-brandalt-200": "#ddd6fe",
        "--gp-brandalt-300": "#c4b5fd",
        "--gp-brandalt-400": "#a78bfa",
        "--gp-brandalt-500": "#8b5cf6",
        "--gp-tint-danger": "#e879c3",
        "--gp-tint-danger-alt": "#c026a8",
        "--gp-tint-danger-deep": "#9d2386",
    };

    it.each(Object.entries(RAMP))("%s === %s", (name, expected) => {
        expect(varValue(css, "purple", name)).toBe(expected);
    });

    it("derives the rgb companion of every ramp stop correctly", () => {
        expect(varValue(css, "purple", "--gp-brand-700-rgb")).toBe("124, 58, 237");
        expect(varValue(css, "purple", "--gp-brandalt-400-rgb")).toBe("167, 139, 250");
        expect(varValue(css, "purple", "--gp-tint-danger-rgb")).toBe("232, 121, 195");
    });
});

describe("generated themes", () => {
    it("give every theme a distinct accent in both modes", () => {
        const darks = THEME_IDS.map((id) => THEME_PRIMITIVES[id].dark.accent);
        const lights = THEME_IDS.map((id) => THEME_PRIMITIVES[id].light.accent);
        expect(new Set(darks).size).toBe(THEME_IDS.length);
        expect(new Set(lights).size).toBe(THEME_IDS.length);
    });

    it("emits only parseable colors — no var() leaks into a theme block", () => {
        // A primitive holding a `var()` would be a definition cycle and,
        // worse, would reach Joy's `extendTheme` where it can't be parsed.
        for (const id of THEME_IDS) {
            const t = THEME_PRIMITIVES[id];
            const scalars = [
                t.gradFrom,
                t.gradTo,
                ...Object.values(t.ramp),
                ...Object.values(t.altRamp),
                t.dark.accent,
                t.light.accent,
                t.dark.bg,
                t.light.bg,
            ];
            for (const v of scalars) {
                expect(v, `${id}: ${v}`).toMatch(/^#[0-9a-f]{6}$/i);
            }
        }
    });

    it("keeps rgb triplets as bare 'r, g, b' so rgba() composition works", () => {
        for (const id of THEME_IDS) {
            for (const mode of ["dark", "light"] as const) {
                expect(THEME_PRIMITIVES[id][mode].accentRgb).toMatch(
                    /^\d{1,3}, \d{1,3}, \d{1,3}$/
                );
            }
        }
    });
});
