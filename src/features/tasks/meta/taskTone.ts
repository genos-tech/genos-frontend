/**
 * The ONE place that says what color a task status or priority is
 * (MIP-1122).
 *
 * Before this, seven independent palettes existed and they disagreed:
 * `taskMeta.statuses` and four copies of `STATUS_COLOR` made Pending purple,
 * `TaskStatusChip.STATUS_COLORS` made it orange, the milestone chip map made
 * it purple again, and the table's filter chips had their own hexes. The same
 * task read as a different color on the table, the dashboard and the
 * milestone card.
 *
 * Now a status or a priority maps to a TONE, and a tone maps to color roles
 * from the design system (`theme/tokens/roles.ts`). Every legacy map
 * (`statuses`, `priorities`, the filter chips, `STATUS_COLORS`,
 * `MILESTONE_STATUS_CHIP_COLORS`, the per-file `STATUS_COLOR`s) is a
 * derived view of this file, so they cannot drift again.
 *
 *   Open → info (blue)      Blocked → danger (red)   Closed → success (green)
 *   WIP → warning (amber)   Pending → neutral        Deleted → muted
 *   Critical → danger   High → warning   Normal → info
 *   Low → neutral       Minimal → muted
 *
 * Two forms of every color, because callers need both:
 *  - `toneCss(tone)`: `var(--g-…)` references, mode- and theme-resolved, for
 *    `sx` / `style`. Cannot be used for JS color math.
 *  - real hex (`toneSolid`, `toneBase`, `toneText`): for the ~34 call sites
 *    that do `alpha(color, 0.5)`, concatenate hex alpha, or hand the color to
 *    canvas / React Flow.
 *
 * Status hues are the same on every color theme (a red "Blocked" must read as
 * red whether the accent is purple or rose), so a single theme stands in when
 * the roles are built; `designTokens.test.ts` asserts they are identical.
 */

import { rgbString } from "../../../theme/tokens/color";
import { buildRoles, SemanticRoles } from "../../../theme/tokens/roles";

export type Tone = "info" | "warning" | "danger" | "success" | "neutral" | "muted";

export const STATUS_NAMES = ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"] as const;
export const PRIORITY_NAMES = ["Minimal", "Low", "Normal", "High", "Critical"] as const;
export type StatusName = (typeof STATUS_NAMES)[number];
export type PriorityName = (typeof PRIORITY_NAMES)[number];

export const STATUS_TONE: Record<StatusName, Tone> = {
    Open: "info",
    WIP: "warning",
    Blocked: "danger",
    Pending: "neutral",
    Closed: "success",
    // Gone from every normal view; kept apart from Blocked's red so the two
    // are never confused (their icons differ too).
    Deleted: "muted",
};

export const PRIORITY_TONE: Record<PriorityName, Tone> = {
    Minimal: "muted",
    Low: "neutral",
    Normal: "info",
    High: "warning",
    Critical: "danger",
};

/** The tone of a status; anything unknown (a legacy or future value) is
 *  `fallback`, which callers set to what they used to fall back to. */
export const statusTone = (status: string | null | undefined, fallback: Tone = "neutral"): Tone =>
    STATUS_TONE[(status ?? "").trim() as StatusName] ?? fallback;

export const priorityTone = (
    priority: string | null | undefined,
    fallback: Tone = "neutral"
): Tone => PRIORITY_TONE[(priority ?? "").trim() as PriorityName] ?? fallback;

// --- real colors -----------------------------------------------------------

type Swatch = {
    /** The hue's 500 stop: mode-independent, for tinted fills and borders. */
    base: string;
    /** A fill that carries `solidFg` text at AA. */
    solid: string;
    solidFg: string;
    /** The hue as text or an icon, readable on a light / on a dark surface. */
    textLight: string;
    textDark: string;
};

const LIGHT = buildRoles("purple", "light");
const DARK = buildRoles("purple", "dark");

const semantic = (key: "info" | "warning" | "danger" | "success"): Swatch => {
    const l: SemanticRoles = LIGHT[key];
    const d: SemanticRoles = DARK[key];
    return {
        base: l.subtle.hex,
        solid: l.solid,
        solidFg: l.solidFg,
        textLight: l.text,
        textDark: d.text,
    };
};

const SWATCH: Record<Tone, Swatch> = {
    info: semantic("info"),
    warning: semantic("warning"),
    danger: semantic("danger"),
    success: semantic("success"),
    // Gray-500 / gray-400 with white / near-black on them (both pass AA).
    neutral: {
        base: "#6b7280",
        solid: "#6b7280",
        solidFg: "#ffffff",
        textLight: LIGHT.textSecondary,
        textDark: DARK.textSecondary,
    },
    muted: {
        base: "#9ca3af",
        solid: "#9ca3af",
        solidFg: "#111114",
        textLight: LIGHT.textTertiary,
        textDark: DARK.textTertiary,
    },
};

/** The hue's 500 stop, for tinted backgrounds and borders (any mode). */
export const toneBase = (tone: Tone): string => SWATCH[tone].base;

/** A solid fill and the text color that sits on it. */
export const toneSolid = (tone: Tone): { bg: string; fg: string } => ({
    bg: SWATCH[tone].solid,
    fg: SWATCH[tone].solidFg,
});

/** The hue as text or an icon, picked for the surface it sits on. */
export const toneText = (tone: Tone, isDark: boolean): string =>
    isDark ? SWATCH[tone].textDark : SWATCH[tone].textLight;

/** `rgba(r, g, b, a)` of the tone's base: the soft chip fill. Keeps the exact
 *  `rgba(r, g, b, 0.12)` shape because callers rewrite the alpha by string. */
export const toneSoftBg = (tone: Tone, alpha: number): string =>
    `rgba(${rgbString(SWATCH[tone].base)}, ${alpha})`;

// --- CSS references --------------------------------------------------------

export type ToneCss = { text: string; subtle: string; border: string };

const CSS: Record<Tone, ToneCss> = {
    info: cssFor("info"),
    warning: cssFor("warning"),
    danger: cssFor("danger"),
    success: cssFor("success"),
    neutral: {
        text: "var(--g-text-secondary)",
        subtle: "var(--g-hover)",
        border: "var(--g-border)",
    },
    muted: {
        text: "var(--g-text-tertiary)",
        subtle: "var(--g-hover)",
        border: "var(--g-border-subtle)",
    },
};

function cssFor(key: "info" | "warning" | "danger" | "success"): ToneCss {
    return {
        text: `var(--g-${key}-text)`,
        subtle: `var(--g-${key}-subtle)`,
        border: `var(--g-${key}-border)`,
    };
}

/** `var(--g-…)` references for `sx` / `style`: theme- and mode-resolved. */
export const toneCss = (tone: Tone): ToneCss => CSS[tone];

// --- Joy color prop ---------------------------------------------------------

/** For Joy components that take a `color` prop (Chip, Badge, Button). Joy has
 *  no "info", so Open maps to `primary`, as the milestone picker always did. */
export const toneJoyColor = (
    tone: Tone
): "primary" | "warning" | "danger" | "success" | "neutral" =>
    ({
        info: "primary",
        warning: "warning",
        danger: "danger",
        success: "success",
        neutral: "neutral",
        muted: "neutral",
    })[tone] as "primary" | "warning" | "danger" | "success" | "neutral";

// --- derived legacy shapes --------------------------------------------------

/** `{ color, textColor }` for a status: a solid fill and its label color. */
export const statusSolid = (status: StatusName): { color: string; textColor: string } => {
    const s = toneSolid(STATUS_TONE[status]);
    return { color: s.bg, textColor: s.fg };
};

export const prioritySolid = (priority: PriorityName): { color: string; textColor: string } => {
    const s = toneSolid(PRIORITY_TONE[priority]);
    return { color: s.bg, textColor: s.fg };
};
