import { g } from "../../theme/tokens";

/**
 * One list of the Today page, recognisable before its title is read (MIP-2442). Every section has
 * the same header (an icon badge, the title, a count pill) and its own icon. WHO HOLDS THE BALL
 * decides the card itself: what is on the viewer is a raised card with a coloured top rule; what is
 * on somebody else ("You are waiting on", "Handed to others") is a recessed, dashed, colourless one,
 * so it can never be read as "Waits on you". Shape and fill carry that, not hue alone.
 */
export type TodayHue = "danger" | "warning" | "accent" | "info" | "neutral";

/** Whose move it is: the viewer's, or somebody else's. */
export type TodayCourt = "mine" | "others";

type Look = { rule: string; tint: string; ink: string; countInk: string };

export const SECTION_LOOK: Record<TodayHue, Look> = {
    danger: {
        rule: g.danger.solid,
        tint: g.danger.subtle,
        ink: g.danger.text,
        countInk: g.danger.text,
    },
    warning: {
        rule: g.warning.solid,
        tint: g.warning.subtle,
        ink: g.warning.text,
        countInk: g.warning.text,
    },
    accent: {
        rule: g.accent.solid,
        tint: g.accent.subtle,
        ink: g.accent.text,
        countInk: g.accent.text,
    },
    info: { rule: g.info.solid, tint: g.info.subtle, ink: g.info.text, countInk: g.info.text },
    neutral: {
        rule: g.border.strong,
        tint: g.active,
        ink: g.text.primary,
        countInk: g.text.secondary,
    },
};

/** The card around a list, by court. Shared with the loading skeleton, so nothing jumps. */
export const sectionCardSx = (court: TodayCourt, rule: string) =>
    ({
        minWidth: 0,
        borderRadius: g.radius.md,
        py: 1,
        ...(court === "mine"
            ? {
                  bgcolor: g.surface.default,
                  border: `1px solid ${g.border.subtle}`,
                  borderTop: `2px solid ${rule}`,
              }
            : { bgcolor: g.bg.subtle, border: `1px dashed ${g.border.strong}` }),
    }) as const;

export const SECTION_HEADER_SX = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minWidth: 0,
    m: 0,
    px: 1.25,
    pt: 0.5,
    pb: 0.75,
} as const;

export const SECTION_BADGE_PX = 24;

/**
 * One column on a phone and a tablet. From a wide screen, two columns of equal-height cards in
 * reading order, so each pair of lists sits side by side and no column ends ragged; a last card
 * on its own spans both. The loading skeleton uses the same grid.
 */
export const SECTIONS_GRID_SX = {
    display: "grid",
    gap: 1.5,
    alignItems: "stretch",
    gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        lg: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1200px)": {
        "& > :last-of-type:nth-of-type(odd)": {
            gridColumn: "1 / -1",
        },
    },
} as const;

/** The day's numbers beside its progress bar. */
export const SUMMARY_GRID_SX = {
    display: "grid",
    gap: 1.5,
    alignItems: "stretch",
    gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        md: "minmax(0, 3fr) minmax(0, 2fr)",
    },
} as const;
