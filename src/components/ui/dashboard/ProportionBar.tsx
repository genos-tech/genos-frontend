import { Box, Typography } from "@mui/joy";

import { Tone, toneSolid } from "../../../features/tasks/meta/taskTone";
import { g, type } from "../../../theme/tokens";
import { AppTooltip } from "../AppTooltip";

/**
 * The one stacked bar (MIP-1963): status, priority, effort, capacity, tags and milestones.
 * 8 px high, track in border-subtle, a 2 px gap in the surface colour between segments, a
 * legend under it. A legend item at 0 is greyed, never hidden, so the order stays fixed.
 *
 * The numbers are never hover-only: `role="img"` with an `aria-label` that reads the counts
 * (the caller builds it from locale strings, e.g. "Open 3, WIP 2, Closed 0"), and the legend
 * prints them.
 */
export type ProportionSegment = {
    key: string;
    label: string;
    value: number;
    /** A tone from the task tone maps... */
    tone?: Tone;
    /** ...or a chart-series token (`g.chart.series1`). One of the two. */
    color?: string;
    /** Formatted count for the legend; defaults to the raw number. */
    display?: string;
};

export type ProportionBarProps = {
    segments: ProportionSegment[];
    /** Reads the counts for assistive tech. */
    ariaLabel: string;
    /** Total for the scale; defaults to the sum (set it to share a scale across rows). */
    total?: number;
    legend?: boolean;
    height?: number;
};

const fillOf = (s: ProportionSegment): string => s.color ?? toneSolid(s.tone ?? "neutral").bg;

export const ProportionBar = ({
    segments,
    ariaLabel,
    total,
    legend = true,
    height = 8,
}: ProportionBarProps) => {
    const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
    const scale = total && total > 0 ? Math.max(total, sum) : sum;
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box
                aria-label={ariaLabel}
                role="img"
                sx={{
                    display: "flex",
                    gap: "2px",
                    height,
                    borderRadius: g.radius.full,
                    background: g.border.subtle,
                    overflow: "hidden",
                }}
            >
                {scale > 0 &&
                    segments
                        .filter((s) => s.value > 0)
                        .map((s) => (
                            <AppTooltip key={s.key} title={`${s.label} ${s.display ?? s.value}`}>
                                <Box
                                    data-segment={s.key}
                                    sx={{
                                        flex: `${s.value} 1 0`,
                                        minWidth: 2,
                                        background: fillOf(s),
                                    }}
                                />
                            </AppTooltip>
                        ))}
                {scale > sum && <Box sx={{ flex: `${scale - sum} 1 0` }} aria-hidden />}
            </Box>
            {legend && (
                <Box
                    component="ul"
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        columnGap: 2,
                        rowGap: 0.5,
                        listStyle: "none",
                        m: 0,
                        mt: 1,
                        p: 0,
                    }}
                >
                    {segments.map((s) => (
                        <Box
                            key={s.key}
                            component="li"
                            data-zero={s.value === 0 ? "true" : undefined}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: g.radius.full,
                                    background: fillOf(s),
                                    flexShrink: 0,
                                    opacity: s.value === 0 ? 0.5 : 1,
                                }}
                                aria-hidden
                            />
                            <Typography sx={{ ...type("body-xs"), color: g.text.secondary }}>
                                {s.label}
                            </Typography>
                            <Typography
                                sx={{
                                    ...type("body-xs"),
                                    color: s.value === 0 ? g.text.secondary : g.text.primary,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {s.display ?? s.value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};
