/**
 * The theme primitives the app actually paints with (MIP-1118).
 *
 * `themePalettes.ts` still holds a full set of per-theme primitives, but
 * its NEUTRAL fields (backgrounds, surfaces, text) and STATUS fields
 * (danger / success / warning) are the old purple-tinted ones. The design
 * system replaces them: neutrals come from `buildRoles` and status hues are
 * real red / green / amber. This module overlays the new values onto the
 * static data, so both consumers read ONE answer:
 *
 *  - `themeStyles.ts` emits the `--gp-*` CSS variables from it, and
 *  - `useColorTheme().raw` (canvas and React Flow, which cannot resolve a
 *    CSS variable) returns it.
 *
 * Brand fields (the ramps, accent family, gradient stops) pass through
 * untouched: the purple theme is still `#7c3aed`.
 *
 * It is a separate module, not an edit to `themePalettes.ts`, because
 * `roles.ts` imports `themePalettes.ts`; importing back would be a cycle.
 * The superseded static neutral and status values stay in `themePalettes.ts`
 * only to keep its types whole; nothing paints them.
 */

import { ModePrimitives, THEME_PRIMITIVES, ThemeId, ThemePrimitives } from "../themePalettes";
import { rgbString } from "./color";
import { buildRoles, Mode, SemanticRoles } from "./roles";

/** Mode-independent danger stops behind `--gp-tint-danger*` (263 call sites
 *  in delete / leave / error UI). Red-600 → red-700 → red-800: white text
 *  passes AA on the first two, so the gradient danger buttons stay legible.
 *  They were magenta (#e879c3 / #c026a8 / #9d2386). */
export const TINT_DANGER = { base: "#dc2626", alt: "#b91c1c", deep: "#991b1b" } as const;

/** `--gp-tint-warning` was never defined (its six call sites fell back to a
 *  yellow in the `var()` default). Amber-600: readable as text on white. */
export const TINT_WARNING = "#d97706";

/** The hue behind a semantic, the way the palette's tint pairs use it:
 *  the readable text shade, the base hue for tinted backgrounds, and the
 *  solid fill for the second stop. */
const tintTriple = (s: SemanticRoles) => ({
    tint: s.text,
    tintRgb: rgbString(s.subtle.hex),
    tintAltRgb: rgbString(s.solid),
});

const overlayMode = (id: ThemeId, mode: Mode, base: ModePrimitives): ModePrimitives => {
    const r = buildRoles(id, mode);
    const danger = tintTriple(r.danger);
    const success = tintTriple(r.success);
    const warning = tintTriple(r.warning);
    return {
        ...base,
        bg: r.bg,
        // surfaceA = card / raised panel, B = recessed, C = elevated.
        surfaceARgb: rgbString(r.surface),
        surfaceBRgb: rgbString(r.bgSubtle),
        surfaceCRgb: rgbString(r.surfaceRaised),
        inputBgRgb: rgbString(r.surface),
        text: r.text,
        textMutedRgb: rgbString(r.textSecondary),
        textSubtleRgb: rgbString(r.textTertiary),
        dangerTint: danger.tint,
        dangerTintRgb: danger.tintRgb,
        dangerTintAltRgb: danger.tintAltRgb,
        successTint: success.tint,
        successTintRgb: success.tintRgb,
        successTintAltRgb: success.tintAltRgb,
        warningTint: warning.tint,
        warningTintRgb: warning.tintRgb,
        warningTintAltRgb: warning.tintAltRgb,
    };
};

const cache = new Map<ThemeId, ThemePrimitives>();

export const resolvedPrimitives = (id: ThemeId): ThemePrimitives => {
    let out = cache.get(id);
    if (!out) {
        const base = THEME_PRIMITIVES[id];
        out = {
            ...base,
            tintDanger: TINT_DANGER.base,
            tintDangerAlt: TINT_DANGER.alt,
            tintDangerDeep: TINT_DANGER.deep,
            dark: overlayMode(id, "dark", base.dark),
            light: overlayMode(id, "light", base.light),
        };
        cache.set(id, out);
    }
    return out;
};
