/**
 * Contrast of the public pages (MIP-1828).
 *
 * The marketing pages (`src/lp/**`) paint with the `--lp-*` variables that
 * `src/lp/kit/lpTheme.ts` publishes from the app's own roles. The app's
 * contrast test (`designTokens.test.ts`) covers the roles in general; this file
 * covers the pairs the public pages really use, in both modes: each text
 * colour against the backgrounds it sits on (translucent fills composited
 * first), each accent-on-gradient pair, and the focus ring.
 *
 * Thresholds: 4.5:1 for text, 3:1 for the focus ring and for UI boundaries.
 *
 * Known failures are listed in `KNOWN_BELOW_AA` with their measured ratio
 * instead of being hidden or silently recoloured: brand colours are a design
 * decision (see the PR that added this file). The test fails if a listed pair
 * gets worse, if a new pair fails, and if a listed pair is fixed (so the list
 * is removed in the same change).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { lpRolesFor, lpSurfaces, lpTextBackdrops, lpVarsFor, withFill } from "../lp/kit/lpTheme";
import { contrast } from "../theme/tokens/color";
import { Mode, RoleColors, SemanticRoles } from "../theme/tokens/roles";
import { MODES } from "../theme/tokens/tokenStyles";

const AA_TEXT = 4.5;
const NON_TEXT = 3;

const here = dirname(fileURLToPath(import.meta.url));

type Pair = { name: string; fg: string; backdrops: Record<string, string>; min: number };

/** Pairs measured below their threshold today: `name` → ratio at the time of
 *  writing. Empty since MIP-1846: tertiary text and accent text are darkened
 *  (light) or lightened (dark) on the public pages by `lpRolesFor`. */
const KNOWN_BELOW_AA: Record<string, number> = {};

const failures = (p: Pair) =>
    Object.entries(p.backdrops)
        .map(([name, bg]) => ({ name, ratio: Math.round(contrast(p.fg, bg) * 100) / 100 }))
        .filter((x) => x.ratio < p.min);

/** Every pair the public pages paint, for one theme mode. */
const pairsFor = (r: RoleColors): Pair[] => {
    const surf = lpSurfaces(r);
    const gradient = Object.fromEntries(r.brandGradientStops.map((c, i) => [`gradient${i}`, c]));
    const solid = { accent: r.accent, accentHover: r.accentHover, ...gradient };
    const semantic = (name: string, s: SemanticRoles): Pair[] => [
        { name: `${name}-text on page`, fg: s.text, backdrops: { ...surf }, min: AA_TEXT },
        {
            name: `${name}-text on ${name} tint`,
            fg: s.text,
            backdrops: withFill(surf, `${name}Tint`, s.subtle),
            min: AA_TEXT,
        },
    ];
    return [
        { name: "text", fg: r.text, backdrops: lpTextBackdrops(r), min: AA_TEXT },
        {
            name: "text-secondary",
            fg: r.textSecondary,
            backdrops: lpTextBackdrops(r),
            min: AA_TEXT,
        },
        { name: "text-tertiary", fg: r.textTertiary, backdrops: lpTextBackdrops(r), min: AA_TEXT },
        { name: "accent-text", fg: r.accentText, backdrops: lpTextBackdrops(r), min: AA_TEXT },
        { name: "accent-fg on accent fills", fg: r.accentFg, backdrops: solid, min: AA_TEXT },
        { name: "focus ring", fg: r.focus, backdrops: surf, min: NON_TEXT },
        {
            name: "accent dot on page (UI boundary)",
            fg: r.accent,
            backdrops: { bg: r.bg, surface: r.surface },
            min: NON_TEXT,
        },
        ...semantic("success", r.success),
        ...semantic("danger", r.danger),
    ];
};

/** Variables the stylesheet reads that are not colours. */
const NON_COLOUR_VARS = new Set(["mono", "measure", "narrow-ratio"]);

const lpCss = readFileSync(resolve(here, "../lp/kit/lp.css"), "utf8");

describe.each(MODES as Mode[])("public pages contrast / %s", (mode) => {
    const r = lpRolesFor(mode);
    const pairs = pairsFor(r);

    it.each(pairs.map((p) => [p.name, p] as const))("%s", (name, pair) => {
        const bad = failures(pair);
        const known = KNOWN_BELOW_AA[`${mode}:${name}`];
        if (known === undefined) {
            expect(bad, `${name} on ${mode}`).toEqual([]);
            return;
        }
        // A listed pair: every failing backdrop must still be the listed one,
        // no worse, and the list must shrink when the pair is fixed.
        expect(
            bad.length,
            `${name} on ${mode} now passes; remove it from KNOWN_BELOW_AA`
        ).toBeGreaterThan(0);
        const worst = Math.min(...bad.map((x) => x.ratio));
        expect(worst, `${name} on ${mode} got worse`).toBeGreaterThanOrEqual(known - 0.005);
    });
});

describe("public pages variables", () => {
    it.each(MODES as Mode[])("every colour the stylesheet reads is published (%s)", (mode) => {
        const defined = new Set(Object.keys(lpVarsFor(mode)));
        const read = [...lpCss.matchAll(/var\(--lp-([a-z0-9-]+)/g)].map((m) => m[1]);
        const missing = [...new Set(read)]
            .filter((n) => !NON_COLOUR_VARS.has(n))
            .filter((n) => !defined.has(`--lp-${n}`));
        expect(missing).toEqual([]);
    });
});
