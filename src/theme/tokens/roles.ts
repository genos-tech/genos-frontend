/**
 * Role colors for the design system (MIP-1106).
 *
 * A role names a JOB ("secondary text", "hover fill", "selected nav
 * background"), not a hue. Components ask for roles, and each theme × mode
 * answers with a concrete color, so a component never has to know which
 * theme or mode it is in. That is what removes the `isDark ? … : …`
 * branches.
 *
 * What comes from where:
 *  - Neutrals (backgrounds, text, borders) are generated in OKLCH from the
 *    accent's hue at very low chroma, so every theme's grays lean faintly
 *    toward its accent and the steps look evenly spaced in every theme.
 *  - The accent comes from the theme's own Tailwind ramp
 *    (`THEME_PRIMITIVES[id].ramp`). The STOP is chosen by contrast, not
 *    fixed: the first stop that passes WCAG AA for its job wins. That is
 *    why amber, teal and emerald land a shade darker than purple does.
 *  - Danger / success / warning / info are the SAME hues on every theme
 *    (Ken, 2026-11-07: "real red/green/amber"). A red error must read as
 *    red whether the accent is purple or rose.
 *
 * Alpha roles (hover, borders, subtle tints) stay translucent so they work
 * on any surface underneath. The contrast test composites them over the
 * surfaces they are used on before measuring.
 */

import { RAMP_STOPS, RampStop, THEME_PRIMITIVES, ThemeId } from "../themePalettes";
import { composite, contrast, hexToOklch, oklchToHex, rgbString } from "./color";

export type Mode = "light" | "dark";

/** A translucent color: `hex` painted at `a`. */
export type Alpha = { hex: string; a: number };

export type SemanticRoles = {
    /** Filled background (badges, destructive button). */
    solid: string;
    /** Text/icon on `solid`. */
    solidFg: string;
    /** The hue as text or icon on a surface. */
    text: string;
    /** Tinted background (callouts, subtle pills). */
    subtle: Alpha;
    border: Alpha;
};

export type RoleColors = {
    // Surfaces, back to front
    bg: string;
    bgSubtle: string;
    surface: string;
    surfaceRaised: string;
    // Interaction fills, translucent
    hover: Alpha;
    active: Alpha;
    // Lines, translucent
    borderSubtle: Alpha;
    border: Alpha;
    borderStrong: Alpha;
    // Text
    text: string;
    textSecondary: string;
    /** Meta only (timestamps, counts, placeholders). Never the only
     *  carrier of information: it is held to 3:1, not 4.5:1. */
    textTertiary: string;
    textDisabled: string;
    // Accent
    accent: string;
    accentHover: string;
    accentFg: string;
    /** Accent as text, link or icon on a surface. */
    accentText: string;
    /** Link text and the quote bar / code ink INSIDE a chat bubble or comment, where the fills
     *  vary (page, surface, hover, sent tint, deep-link tint). Held to a higher contrast than
     *  `accentText` (dark 9.5:1, light AA) because a bubble's tinted fills are the worst case. */
    link: string;
    linkVisited: string;
    linkHover: string;
    /** Quoted text in a bubble: dimmer than the body text, but 7:1 on every bubble fill (the
     *  secondary text role is 5.5-6.6:1 there). */
    textQuote: string;
    /** Selected-row / selected-nav background. */
    accentSubtle: Alpha;
    accentBorder: Alpha;
    focus: string;
    /** The one place a gradient survives: primary buttons and brand
     *  moments (Genos / Ask). */
    brandGradient: string;
    brandGradientHover: string;
    /** Stops of the two gradients, kept for the contrast test. */
    brandGradientStops: [string, string, string, string];
    // Semantics
    danger: SemanticRoles;
    success: SemanticRoles;
    warning: SemanticRoles;
    info: SemanticRoles;
    // Depth
    scrim: Alpha;
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
    /** The ink the translucent roles are made of, as "r, g, b". */
    inkRgb: string;
};

const WHITE = "#ffffff";
/** Near-black used for text on light solids (amber warning). */
const ON_LIGHT = "#111114";
const AA = 4.5;

/** Fixed semantic hues (Tailwind red / green / amber / blue). */
const SEMANTIC_RAMPS = {
    danger: {
        300: "#fca5a5",
        400: "#f87171",
        500: "#ef4444",
        600: "#dc2626",
        700: "#b91c1c",
        800: "#991b1b",
    },
    success: {
        300: "#86efac",
        400: "#4ade80",
        500: "#22c55e",
        600: "#16a34a",
        700: "#15803d",
        800: "#166534",
    },
    warning: {
        300: "#fcd34d",
        400: "#fbbf24",
        500: "#f59e0b",
        600: "#d97706",
        700: "#b45309",
        800: "#92400e",
    },
    info: {
        300: "#93c5fd",
        400: "#60a5fa",
        500: "#3b82f6",
        600: "#2563eb",
        700: "#1d4ed8",
        800: "#1e40af",
    },
} as const;

/** Which stop each semantic fills with. Text on it is chosen by contrast:
 *  warning stays bright amber with dark text, as warnings usually are. */
const SEMANTIC_SOLID_STOP = { danger: 600, success: 700, warning: 500, info: 600 } as const;

/** Purple's identity color is `#7c3aed` (ramp 700); every other theme
 *  centres on 600, the stop its Tailwind family treats as the base. */
const BRAND_STOP: Record<ThemeId, RampStop> = {
    purple: 700,
    blue: 600,
    teal: 600,
    emerald: 600,
    amber: 600,
    rose: 600,
    slate: 600,
};

const stepFrom = (stop: RampStop, by: number): RampStop =>
    RAMP_STOPS[Math.min(RAMP_STOPS.length - 1, Math.max(0, RAMP_STOPS.indexOf(stop) + by))];

/** Readable text for a solid: white when it passes AA, else near-black. */
const fgFor = (solid: string): string => (contrast(WHITE, solid) >= AA ? WHITE : ON_LIGHT);

/** The first candidate that reaches AA against EVERY backdrop. Falls back
 *  to the last candidate (the most extreme), which the test then flags if
 *  it still fails, rather than silently shipping an unreadable color. */
const firstReadable = (candidates: string[], backdrops: string[]): string =>
    candidates.find((c) => backdrops.every((b) => contrast(c, b) >= AA)) ??
    candidates[candidates.length - 1];

/** The lowest contrast of `fg` over `backdrops`. */
const worstOn = (fg: string, backdrops: string[]): number =>
    Math.min(...backdrops.map((b) => contrast(fg, b)));

/** The first candidate that reaches `floor` on every backdrop; the last one if none does. */
const firstAtLeast = (candidates: string[], backdrops: string[], floor: number): string =>
    candidates.find((c) => worstOn(c, backdrops) >= floor) ?? candidates[candidates.length - 1];

/** `hex` turned `turn` degrees around the hue wheel, then moved along lightness (`step` per
 *  try) until it reaches `floor` on every backdrop. A visited link is the family's color
 *  rotated and calmed, the way the old indigo went to violet; a theme with no chroma (slate) stays gray. */
const turnedUntil = (
    hex: string,
    turn: number,
    keep: number,
    step: number,
    backdrops: string[],
    floor: number
): string => {
    const { l, c, h } = hexToOklch(hex);
    let out = oklchToHex(l, c * keep, (h + turn) % 360);
    for (let i = 1; i <= 80 && worstOn(out, backdrops) < floor; i++) {
        out = oklchToHex(l + step * i, c * keep, (h + turn) % 360);
    }
    return out;
};

/** Contrast floors for links and quote text on the bubble fills. They are the worst case the
 *  legacy hex values measured (dark links #a5b4fc..#e0e7ff: 6.8 to 11.4; quote text #cbd5e1 /
 *  #c7d2fe: 9.1 to 9.5), so moving a rule from the hex to the role never lowers a fill's
 *  contrast (SpotlightLeftoversTokens proves it per theme and fill). Light links stay at AA
 *  and the quote text at 7:1: a darker light link would only recolor the quote bars. */
const LINK_FLOOR = { light: AA, dark: 9.5 } as const;
const LINK_VISITED_FLOOR = { light: AA, dark: 10.2 } as const;
const LINK_HOVER_FLOOR = { light: AA, dark: 11.4 } as const;
/** How far a visited link turns from its link, in OKLCH hue degrees. */
const VISITED_TURN = 30;
/** ...and how much of its chroma it keeps, so the turn stays quiet. */
const VISITED_CHROMA = 0.7;
const QUOTE_TEXT_FLOOR = { light: 7, dark: 9.5 } as const;

/** Neutral lightness / chroma steps, per mode. Read off the references
 *  (Linear, Vercel Geist): near-white canvas with white cards in light,
 *  a deep but not pure-black canvas in dark. */
const NEUTRAL = {
    light: {
        bg: [0.985, 0.004],
        bgSubtle: [0.97, 0.006],
        surface: [1, 0],
        surfaceRaised: [1, 0],
        text: [0.235, 0.016],
        textSecondary: [0.475, 0.02],
        textTertiary: [0.6, 0.018],
        textDisabled: [0.74, 0.012],
        ink: [0.235, 0.02],
    },
    dark: {
        bg: [0.155, 0.012],
        bgSubtle: [0.178, 0.013],
        surface: [0.2, 0.014],
        surfaceRaised: [0.232, 0.015],
        text: [0.955, 0.006],
        textSecondary: [0.765, 0.012],
        textTertiary: [0.615, 0.012],
        textDisabled: [0.46, 0.01],
        ink: [0.985, 0.004],
    },
} as const;

const ALPHA = {
    light: { hover: 0.045, active: 0.08, borderSubtle: 0.07, border: 0.11, borderStrong: 0.2 },
    dark: { hover: 0.06, active: 0.1, borderSubtle: 0.07, border: 0.11, borderStrong: 0.2 },
} as const;

export const alphaCss = ({ hex, a }: Alpha): string => `rgba(${rgbString(hex)}, ${a})`;

const buildSemantic = (
    key: keyof typeof SEMANTIC_RAMPS,
    mode: Mode,
    surfaces: string[]
): SemanticRoles => {
    const ramp = SEMANTIC_RAMPS[key];
    const solid = ramp[SEMANTIC_SOLID_STOP[key]];
    const subtle: Alpha = { hex: ramp[500], a: mode === "light" ? 0.1 : 0.16 };
    // Text must also read on its OWN tinted background (a red callout's
    // red text), so the composited tint joins the backdrops.
    const tinted = surfaces.map((s) => composite(subtle.hex, subtle.a, s));
    const order = mode === "light" ? [ramp[700], ramp[800]] : [ramp[400], ramp[300]];
    return {
        solid,
        solidFg: fgFor(solid),
        text: firstReadable(order, [...surfaces, ...tinted]),
        subtle,
        border: { hex: ramp[500], a: mode === "light" ? 0.3 : 0.35 },
    };
};

export const buildRoles = (themeId: ThemeId, mode: Mode): RoleColors => {
    const t = THEME_PRIMITIVES[themeId];
    const hue = hexToOklch(t.ramp[600]).h;
    const n = NEUTRAL[mode];
    const g = (k: keyof typeof n) => oklchToHex(n[k][0], n[k][1], hue);
    const ink = g("ink");
    const al = ALPHA[mode];
    const bg = g("bg");
    const bgSubtle = g("bgSubtle");
    const surface = g("surface");
    const surfaceRaised = g("surfaceRaised");
    const surfaces = [bg, bgSubtle, surface, surfaceRaised];

    // Accent solid: the brand stop, darkened one step at a time until white
    // text on it passes AA.
    const brand = BRAND_STOP[themeId];
    let solidStop = brand;
    while (contrast(WHITE, t.ramp[solidStop]) < AA && solidStop < 900) {
        solidStop = stepFrom(solidStop, 1);
    }
    const accent = t.ramp[solidStop];
    const accentSubtle: Alpha = { hex: accent, a: mode === "light" ? 0.1 : 0.2 };
    const selectedBgs = surfaces.map((s) => composite(accent, accentSubtle.a, s));

    // Accent as text: must read on every surface AND on its own selected
    // tint (a selected nav label sits on `accentSubtle`).
    const textCandidates =
        mode === "light"
            ? [brand, stepFrom(brand, 1), stepFrom(brand, 2), stepFrom(brand, 3)].map(
                  (s) => t.ramp[s]
              )
            : [t.altRamp[400], t.altRamp[300], t.altRamp[200], t.ramp[200], t.ramp[100]];
    const accentText = firstReadable(textCandidates, [...surfaces, ...selectedBgs]);

    // Link family and quote text, on the fills a bubble can have: the page and the surface, each
    // plain and with the hover wash, the sent (accent) tint and the deep-link (success) tint.
    const success = buildSemantic("success", mode, surfaces);
    const bubbleFills = [bg, surface].flatMap((base) => [
        base,
        composite(ink, al.hover, base),
        composite(accent, accentSubtle.a, base),
        composite(success.subtle.hex, success.subtle.a, base),
    ]);
    // Dark: from the light stops up (more contrast = lighter). Light: from the 700 stop down,
    // the stop the quote bars and code were always painted in, darker only where it misses AA.
    const linkStops =
        mode === "dark"
            ? [t.altRamp[300], t.altRamp[200], t.ramp[200], t.ramp[100], t.ramp[50]]
            : [t.ramp[700], t.ramp[800], t.ramp[900]];
    const link = firstAtLeast(linkStops, bubbleFills, LINK_FLOOR[mode]);
    const darker = linkStops.slice(linkStops.indexOf(link) + 1);
    const linkHover = firstAtLeast(
        mode === "dark" ? linkStops : darker.length ? darker : [link],
        bubbleFills,
        LINK_HOVER_FLOOR[mode]
    );
    const linkVisited = turnedUntil(
        link,
        VISITED_TURN,
        VISITED_CHROMA,
        mode === "dark" ? 0.005 : -0.005,
        bubbleFills,
        LINK_VISITED_FLOOR[mode]
    );
    // Quote text: the neutral ramp, lightness walked from secondary text until it clears the floor.
    const [quoteL0, quoteC] = n.textSecondary;
    let textQuote = oklchToHex(quoteL0, quoteC, hue);
    for (let i = 1; i <= 80 && worstOn(textQuote, bubbleFills) < QUOTE_TEXT_FLOOR[mode]; i++) {
        textQuote = oklchToHex(quoteL0 + (mode === "dark" ? 0.005 : -0.005) * i, quoteC, hue);
    }

    const g1 = accent;
    const g2 = t.ramp[stepFrom(solidStop, 2)];
    const g3 = t.ramp[stepFrom(solidStop, 1)];
    const g4 = t.ramp[stepFrom(solidStop, 3)];

    const inkRgb = rgbString(ink);
    const shadow =
        mode === "light"
            ? {
                  sm: `0 1px 2px rgba(${inkRgb}, 0.06)`,
                  md: `0 1px 2px rgba(${inkRgb}, 0.06), 0 4px 12px -2px rgba(${inkRgb}, 0.1)`,
                  lg: `0 2px 6px rgba(${inkRgb}, 0.08), 0 16px 40px -8px rgba(${inkRgb}, 0.2)`,
              }
            : {
                  sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
                  md: "0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 16px -2px rgba(0, 0, 0, 0.5)",
                  lg: "0 2px 6px rgba(0, 0, 0, 0.45), 0 16px 48px -8px rgba(0, 0, 0, 0.6)",
              };

    return {
        bg,
        bgSubtle,
        surface,
        surfaceRaised,
        hover: { hex: ink, a: al.hover },
        active: { hex: ink, a: al.active },
        borderSubtle: { hex: ink, a: al.borderSubtle },
        border: { hex: ink, a: al.border },
        borderStrong: { hex: ink, a: al.borderStrong },
        text: g("text"),
        textSecondary: g("textSecondary"),
        textTertiary: g("textTertiary"),
        textDisabled: g("textDisabled"),
        accent,
        // One step darker; at the end of the ramp, one step lighter, so a
        // hover is always visible.
        accentHover: t.ramp[stepFrom(solidStop, solidStop === 900 ? -1 : 1)],
        // White whenever it passes, which the loop above makes the normal
        // case; near-black only if a ramp never gets dark enough.
        accentFg: fgFor(accent),
        accentText,
        link,
        linkVisited,
        linkHover,
        textQuote,
        accentSubtle,
        accentBorder: { hex: accent, a: 0.35 },
        focus: accentText,
        brandGradient: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`,
        brandGradientHover: `linear-gradient(135deg, ${g3} 0%, ${g4} 100%)`,
        brandGradientStops: [g1, g2, g3, g4],
        danger: buildSemantic("danger", mode, surfaces),
        success,
        warning: buildSemantic("warning", mode, surfaces),
        info: buildSemantic("info", mode, surfaces),
        scrim: mode === "light" ? { hex: ink, a: 0.32 } : { hex: "#000000", a: 0.55 },
        shadowSm: shadow.sm,
        shadowMd: shadow.md,
        shadowLg: shadow.lg,
        inkRgb,
    };
};
