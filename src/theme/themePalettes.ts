/**
 * The selectable color themes.
 *
 * ## How theming works here
 *
 * `purplePalette.ts` used to hold literal colors. It now holds *formulas*
 * over a small set of CSS custom properties — `var(--gp-dark-accent)`,
 * `rgba(var(--gp-brand-rgb), 0.2)` and so on. This file owns the values
 * those properties resolve to, one block per theme, emitted as a
 * stylesheet keyed on `:root[data-theme="…"]` (see `themeStyles.ts`).
 *
 * That indirection is what makes a theme switch possible at all:
 * `components/ui/styles/commonStyle.ts` destructures the palette at
 * **module load** into 14 static objects that 33 files import, so no hook
 * or context could ever re-derive them. CSS variables re-resolve on
 * repaint, so those frozen objects follow the theme for free.
 *
 * ## Primitives, not tokens
 *
 * Only ~20 primitives per mode live here. Every derived surface (borders,
 * chips, menus, shadows, the semantic tints) is composed from them inside
 * `purplePalette.ts` as `rgba(var(--…-rgb), α)`. Adding a theme therefore
 * means picking a ramp, not restating 60 tokens.
 *
 * ## What lives here, and what does not (MIP-1118, MIP-1146)
 *
 * This file is the BRAND data of each theme: the accent ramp, its secondary
 * stops, the gradient stops and the per-mode accent family. The neutrals
 * (page and surface colours, text) and the status hues (danger, success,
 * warning) are NOT here: they come from the design roles
 * (`tokens/roles.ts`, real red / green / amber on every theme) and are
 * overlaid by `tokens/primitives.ts`, which is the only producer of the
 * fully resolved `ThemePrimitives` the rest of the app reads. Genuinely
 * functional colors (task status, priority flags, the tag picker, the
 * online-status dot) never came from here and stay constant across themes.
 */

export type ThemeId = "purple" | "blue" | "teal" | "emerald" | "amber" | "rose" | "slate";

/** Per-mode BRAND values: the accent family. This is all a theme owns per mode. `*Rgb` entries
 *  are bare "r, g, b" triplets so they can be composed at any alpha via `rgba(var(--x-rgb), α)`. */
export type ModeBrand = {
    accent: string;
    accentRgb: string;
    accentStrong: string;
    accentSoft: string;
    accentSoftRgb: string;
    accentMuted: string;
    accentMutedRgb: string;
};

/** Per-mode RESOLVED values: the brand family plus the neutrals and status tints, which only
 *  `tokens/primitives.ts` produces (from the design roles). */
export type ModePrimitives = ModeBrand & {
    /** Page background. */
    bg: string;
    /** Raised panel / card. */
    surfaceARgb: string;
    /** Recessed or second gradient stop. */
    surfaceBRgb: string;
    /** Elevated (menus, popovers). */
    surfaceCRgb: string;
    inputBgRgb: string;

    text: string;
    textMutedRgb: string;
    textSubtleRgb: string;

    dangerTint: string;
    dangerTintRgb: string;
    dangerTintAltRgb: string;
    successTint: string;
    successTintRgb: string;
    successTintAltRgb: string;
    warningTint: string;
    warningTintRgb: string;
    warningTintAltRgb: string;
};

/** What a theme is: brand data only. */
export type ThemeBrand = {
    /** The canonical brand triplet. Mode-INDEPENDENT: the original palette
     *  composes the same `rgba(124,58,237, α)` in both light and dark and
     *  varies only the alpha, and ~600 call sites across the app do the
     *  same. Keeping it single-valued preserves that exactly. */
    brandRgb: string;
    /** Second brand stop, used as the far end of chip / button gradients
     *  in BOTH modes (the original composes `rgba(124,58,237,α)` →
     *  `rgba(139,92,246,α)` in dark and light alike). */
    brandAltRgb: string;
    /** Solid-button / hero gradient stops, also mode-independent. */
    gradFrom: string;
    gradTo: string;
    gradFromHover: string;
    gradToHover: string;
    /** Joy `primary` ramp (50→900), fed to `extendTheme` as real hex so
     *  Joy's channel-token generation has something it can parse. */
    ramp: Record<RampStop, string>;
    /**
     * Secondary ramp stops.
     *
     * Purple's chrome was hand-blended from TWO Tailwind families: the
     * `ramp` above runs purple-50…600 then violet-600…800, while a second
     * set of violet stops (`#8b5cf6`, `#a78bfa`, `#c4b5fd`, `#ddd6fe`)
     * appears throughout the app and is NOT on that ramp. Substituting the
     * nearest ramp stop would visibly shift the default theme, so those
     * four keep their own aliases. Single-family themes just repeat the
     * ramp here.
     */
    altRamp: Record<200 | 300 | 400 | 500 | 900 | 950, string>;
    /** Deepest stop, below `ramp[900]`. Used by heading gradients and the
     *  darkest bubble tokens, which sit below the Tailwind 900 stop. */
    ramp950: string;
    dark: ModeBrand;
    light: ModeBrand;
};

/** A theme as the app reads it: brand data plus the resolved neutrals and status tints. */
export type ThemePrimitives = Omit<ThemeBrand, "dark" | "light"> & {
    /** The danger tints, mode-independent (the app hardcodes the same three values in both modes). */
    tintDanger: string;
    tintDangerAlt: string;
    tintDangerDeep: string;
    dark: ModePrimitives;
    light: ModePrimitives;
};

export type RampStop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const RAMP_STOPS: RampStop[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
export const ALT_RAMP_STOPS: Array<200 | 300 | 400 | 500 | 900 | 950> = [
    200, 300, 400, 500, 900, 950,
];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** "r, g, b" — the shape `rgba(var(--x-rgb), α)` needs. */
export const rgbTriplet = (hex: string): string => hexToRgb(hex).join(", ");

/** Scale a hex toward black. Produces the "950" stop Tailwind ramps stop
 *  short of, which heading gradients and the darkest bubble tokens need. */
const deepen = (hex: string, factor: number): string =>
    "#" +
    hexToRgb(hex)
        .map((v) =>
            Math.round(v * factor)
                .toString(16)
                .padStart(2, "0")
        )
        .join("");

// ---------------------------------------------------------------------------
// Theme seeds
// ---------------------------------------------------------------------------

/**
 * A theme is defined by its accent ramp plus the two hue neighbours its
 * semantic tints borrow from. Ramps are the Tailwind scales the codebase
 * already draws from (`#7c3aed` is violet-600, `#a78bfa` violet-400 …), so
 * the new themes are as considered as the original rather than machine-
 * generated near-misses.
 */
type ThemeSeed = {
    ramp: ThemeBrand["ramp"];
    /** Gradient stops for solid buttons / hero fills. */
    grad: { from: string; to: string; fromHover: string; toHover: string };
};

const buildBrand = (seed: ThemeSeed): ThemeBrand => ({
    brandRgb: rgbTriplet(seed.ramp[700]),
    brandAltRgb: rgbTriplet(seed.ramp[500]),
    gradFrom: seed.grad.from,
    gradTo: seed.grad.to,
    gradFromHover: seed.grad.fromHover,
    gradToHover: seed.grad.toHover,
    ramp: seed.ramp,
    // One Tailwind family, so the secondary stops ARE the ramp stops.
    altRamp: {
        200: seed.ramp[200],
        300: seed.ramp[300],
        400: seed.ramp[400],
        500: seed.ramp[500],
        900: seed.ramp[900],
        950: deepen(seed.ramp[900], 0.62),
    },
    ramp950: deepen(seed.ramp[900], 0.62),
    dark: {
        accent: seed.ramp[500],
        accentRgb: rgbTriplet(seed.ramp[500]),
        accentStrong: seed.ramp[700],
        accentSoft: seed.ramp[400],
        accentSoftRgb: rgbTriplet(seed.ramp[400]),
        accentMuted: seed.ramp[300],
        accentMutedRgb: rgbTriplet(seed.ramp[300]),
    },
    light: {
        accent: seed.ramp[700],
        accentRgb: rgbTriplet(seed.ramp[700]),
        accentStrong: seed.ramp[800],
        accentSoft: seed.ramp[600],
        accentSoftRgb: rgbTriplet(seed.ramp[600]),
        accentMuted: seed.ramp[500],
        accentMutedRgb: rgbTriplet(seed.ramp[500]),
    },
});

// ---------------------------------------------------------------------------
// The themes
// ---------------------------------------------------------------------------

/**
 * Purple — the shipped default, written out as LITERALS rather than run
 * through `buildPrimitives`. The generated surfaces land a shade or two
 * off the hand-tuned originals, and the default theme has to stay
 * pixel-identical to what users see today; the factory only has to be
 * good enough for the themes nobody has seen yet.
 */
const purple: ThemeBrand = {
    brandRgb: "124, 58, 237",
    brandAltRgb: "139, 92, 246",
    gradFrom: "#7c3aed",
    gradTo: "#5b21b6",
    gradFromHover: "#8b5cf6",
    gradToHover: "#6d28d9",
    ramp: {
        50: "#faf5ff",
        100: "#f3e8ff",
        200: "#e9d5ff",
        300: "#d8b4fe",
        400: "#c084fc",
        500: "#a855f7",
        600: "#9333ea",
        700: "#7c3aed",
        800: "#6d28d9",
        900: "#5b21b6",
    },
    altRamp: {
        200: "#ddd6fe",
        300: "#c4b5fd",
        400: "#a78bfa",
        500: "#8b5cf6",
        900: "#4c1d95",
        950: "#2e1065",
    },
    ramp950: "#3b0764",
    dark: {
        accent: "#8b5cf6",
        accentRgb: "139, 92, 246",
        accentStrong: "#7c3aed",
        accentSoft: "#a78bfa",
        accentSoftRgb: "167, 139, 250",
        accentMuted: "#c084fc",
        accentMutedRgb: "192, 132, 252",
    },
    light: {
        accent: "#7c3aed",
        accentRgb: "124, 58, 237",
        accentStrong: "#6d28d9",
        accentSoft: "#9333ea",
        accentSoftRgb: "147, 51, 234",
        accentMuted: "#a855f7",
        accentMutedRgb: "168, 85, 247",
    },
};

export const THEME_PRIMITIVES: Record<ThemeId, ThemeBrand> = {
    purple,

    // Blue → tints lean cyan / sky.
    blue: buildBrand({
        ramp: {
            50: "#eff6ff",
            100: "#dbeafe",
            200: "#bfdbfe",
            300: "#93c5fd",
            400: "#60a5fa",
            500: "#3b82f6",
            600: "#2563eb",
            700: "#1d4ed8",
            800: "#1e40af",
            900: "#1e3a8a",
        },
        grad: { from: "#2563eb", to: "#1e3a8a", fromHover: "#3b82f6", toHover: "#1e40af" },
    }),

    // Teal → tints lean cyan / green.
    teal: buildBrand({
        ramp: {
            50: "#f0fdfa",
            100: "#ccfbf1",
            200: "#99f6e4",
            300: "#5eead4",
            400: "#2dd4bf",
            500: "#14b8a6",
            600: "#0d9488",
            700: "#0f766e",
            800: "#115e59",
            900: "#134e4a",
        },
        grad: { from: "#0d9488", to: "#134e4a", fromHover: "#14b8a6", toHover: "#115e59" },
    }),

    // Emerald → tints lean teal / lime.
    emerald: buildBrand({
        ramp: {
            50: "#ecfdf5",
            100: "#d1fae5",
            200: "#a7f3d0",
            300: "#6ee7b7",
            400: "#34d399",
            500: "#10b981",
            600: "#059669",
            700: "#047857",
            800: "#065f46",
            900: "#064e3b",
        },
        grad: { from: "#059669", to: "#064e3b", fromHover: "#10b981", toHover: "#065f46" },
    }),

    // Amber → tints lean orange / yellow.
    amber: buildBrand({
        ramp: {
            50: "#fffbeb",
            100: "#fef3c7",
            200: "#fde68a",
            300: "#fcd34d",
            400: "#fbbf24",
            500: "#f59e0b",
            600: "#d97706",
            700: "#b45309",
            800: "#92400e",
            900: "#78350f",
        },
        grad: { from: "#d97706", to: "#78350f", fromHover: "#f59e0b", toHover: "#92400e" },
    }),

    // Rose → tints lean pink / fuchsia (closest in spirit to the original).
    rose: buildBrand({
        ramp: {
            50: "#fff1f2",
            100: "#ffe4e6",
            200: "#fecdd3",
            300: "#fda4af",
            400: "#fb7185",
            500: "#f43f5e",
            600: "#e11d48",
            700: "#be123c",
            800: "#9f1239",
            900: "#881337",
        },
        grad: { from: "#e11d48", to: "#881337", fromHover: "#f43f5e", toHover: "#9f1239" },
    }),

    // Slate → the low-chroma option, for people who want the UI to recede.
    slate: buildBrand({
        ramp: {
            50: "#f8fafc",
            100: "#f1f5f9",
            200: "#e2e8f0",
            300: "#cbd5e1",
            400: "#94a3b8",
            500: "#64748b",
            600: "#475569",
            700: "#334155",
            800: "#1e293b",
            900: "#0f172a",
        },
        grad: { from: "#475569", to: "#0f172a", fromHover: "#64748b", toHover: "#1e293b" },
    }),
};

export const DEFAULT_THEME_ID: ThemeId = "purple";

export const THEME_IDS = Object.keys(THEME_PRIMITIVES) as ThemeId[];

export const isThemeId = (v: unknown): v is ThemeId =>
    typeof v === "string" && (THEME_IDS as string[]).includes(v);

/** Swatch color for the Settings picker — the accent each mode actually
 *  renders with, so the dot matches what selecting it produces. */
export const themeSwatch = (id: ThemeId, isDark: boolean): string =>
    isDark ? THEME_PRIMITIVES[id].dark.accent : THEME_PRIMITIVES[id].light.accent;
