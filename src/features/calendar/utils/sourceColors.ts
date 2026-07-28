/**
 * Colors for distinguishing calendars in the merged grid.
 *
 * Once several accounts are overlaid in one view, color is the only
 * thing telling the user that the 10am block is a work meeting and the
 * 10:30 one is a dentist appointment on their personal calendar. Every
 * event therefore gets its color from its SOURCE — the (account,
 * calendar) pair — rather than the single brand accent everything used
 * to wear.
 *
 * Two ways a source gets a color, in order:
 *
 *   1. Google's own `backgroundColor` for that calendar. Strongly
 *      preferred — it's the color the user already assigned in Google
 *      Calendar, so the two UIs agree and nothing has to be re-learned.
 *   2. A fallback palette, indexed by a hash of the source key. Stable
 *      across reloads (the same calendar always lands on the same
 *      color) and chosen to stay legible on both themes.
 */

import { sourceKey } from "../../integrations/services/calendar";

/**
 * Fallback hues. Picked to be distinguishable from each other including
 * for the most common forms of color blindness (no red/green pair
 * adjacent in the cycle), and mid-saturation so white text reads on the
 * solid variant while the soft variant stays subtle on a dark grid.
 */
const FALLBACK_PALETTE = [
    "#4285F4", // blue
    "#B26BD8", // purple
    "#F5A623", // amber
    "#00A3A3", // teal
    "#E8688F", // rose
    "#7CB342", // olive
    "#F06292", // pink
    "#5C6BC0", // indigo
] as const;

/** FNV-1a. Any stable string hash works; this one is short, has no
 *  dependencies, and spreads adjacent keys (which differ only in a few
 *  characters) across different buckets. */
const hash = (value: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

const isUsableHex = (value: string | null | undefined): value is string =>
    typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

/**
 * Resolve the base color for one source, in isolation.
 *
 * `googleColor` is `CalendarSummary.background_color` when known. It's
 * validated rather than trusted: it goes straight into a CSS value, and
 * a malformed string would silently break the rule it lands in (or, for
 * a crafted one, escape the property).
 *
 * Prefer `assignSourceColors` when coloring a whole set. Hashing each
 * source independently means two of them can land on the same palette
 * entry — with 8 colors that's a 1-in-8 chance for any given pair, and
 * the pair it matters most for (a work "primary" and a personal
 * "primary" side by side) is the one the user looks at every day.
 */
export const resolveSourceColor = (
    accountId: string,
    calendarId: string,
    googleColor?: string | null
): string => {
    if (isUsableHex(googleColor)) return googleColor;
    const key = sourceKey(accountId, calendarId);
    return FALLBACK_PALETTE[hash(key) % FALLBACK_PALETTE.length];
};

interface ColorAssignable {
    accountId: string;
    calendarId: string;
    googleColor?: string | null;
}

/**
 * Color a whole set of sources, guaranteeing no two share a fallback
 * color while the palette holds out.
 *
 * Order of preference per source:
 *   1. Google's own color for that calendar (never overridden — if the
 *      user gave two calendars the same color in Google, that's their
 *      call and mirroring it keeps the two UIs honest).
 *   2. Its hashed palette entry, if still free.
 *   3. The next free entry, walking the palette from that point.
 *
 * Assignment is stable in the way that matters: it depends only on the
 * order `sources` arrives in, and the server returns calendars in a
 * deterministic order, so re-opening the modal reproduces the same
 * colors. Connecting a NEW account appends to the end and therefore
 * can't recolor the calendars already on screen.
 */
export const assignSourceColors = (sources: ColorAssignable[]): Record<string, string> => {
    const out: Record<string, string> = {};
    const used = new Set<string>();

    // Pass 1 — honour Google's colors and reserve them, so a fallback
    // in pass 2 doesn't duplicate one.
    for (const s of sources) {
        if (isUsableHex(s.googleColor)) {
            const key = sourceKey(s.accountId, s.calendarId);
            out[key] = s.googleColor;
            used.add(s.googleColor.toLowerCase());
        }
    }

    // Pass 2 — everything else takes its hashed slot, or the next free
    // one after it.
    for (const s of sources) {
        const key = sourceKey(s.accountId, s.calendarId);
        if (out[key]) continue;
        const start = hash(key) % FALLBACK_PALETTE.length;
        let chosen = FALLBACK_PALETTE[start];
        for (let i = 0; i < FALLBACK_PALETTE.length; i++) {
            const candidate = FALLBACK_PALETTE[(start + i) % FALLBACK_PALETTE.length];
            if (!used.has(candidate.toLowerCase())) {
                chosen = candidate;
                break;
            }
        }
        // If every palette entry is taken (more calendars than colors)
        // `chosen` stays at the hashed slot and colors repeat — at that
        // point the legend in the side rail is doing the work anyway.
        out[key] = chosen;
        used.add(chosen.toLowerCase());
    }

    return out;
};

/** Expand `#rrggbb` into an "r, g, b" triple for use inside
 *  `rgba(...)`. Lets one base color drive a whole set of derived
 *  surfaces (soft fill, hover, border) at different alphas without
 *  storing four colors per source. */
export const hexToRgbTriple = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
};

/** The surfaces one source's color drives on the grid. Derived from a
 *  single base so a calendar reads as "the same color" whether it's a
 *  month chip, a timeline block, or a legend swatch. */
export interface SourcePalette {
    /** Full-strength color — legend swatches, the chip's left rule. */
    base: string;
    /** Event background. */
    fill: string;
    /** Event background on hover. */
    fillHover: string;
    /** Event border. */
    border: string;
    /** Text on top of `fill`. Kept at theme foreground rather than the
     *  source color: colored-on-colored text at these alphas fails
     *  contrast for the lighter palette entries. */
    text: string;
}

export const buildSourcePalette = (base: string, isDark: boolean): SourcePalette => {
    const rgb = hexToRgbTriple(base);
    return {
        base,
        fill: isDark ? `rgba(${rgb}, 0.34)` : `rgba(${rgb}, 0.16)`,
        fillHover: isDark ? `rgba(${rgb}, 0.48)` : `rgba(${rgb}, 0.28)`,
        border: isDark ? `rgba(${rgb}, 0.75)` : `rgba(${rgb}, 0.6)`,
        text: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)",
    };
};

/**
 * Palette lookup for an event, keyed off the `_source` the aggregate
 * endpoint attached.
 *
 * Events with no `_source` (a single-source fetch, or a stale cached
 * payload from before this feature) fall back to the default color so
 * they still render rather than disappearing into an undefined lookup.
 */
export const paletteForEvent = (
    source: { account_id: string; calendar_id: string } | undefined,
    colorBySource: Record<string, string>,
    isDark: boolean
): SourcePalette => {
    const key = source ? sourceKey(source.account_id, source.calendar_id) : "";
    const base = colorBySource[key] ?? FALLBACK_PALETTE[0];
    return buildSourcePalette(base, isDark);
};
