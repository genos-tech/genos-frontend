import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../i18n";
import { VelocityGranularity, VelocityPoint } from "../../services/loadTaskVelocity";

type Props = {
    data: VelocityPoint[];
    granularity: VelocityGranularity;
    isDark: boolean;
    textMuted: string;
    textSecondary: string;
};

// One key per series. Order = draw order left→right within a bucket and
// legend order.
//
// These four hues are FIXED and deliberately not theme-derived. Series
// color is an identity channel: "which of the four measures is this bar".
// `updated` used to read `var(--gp-brandalt-400)`, so on the blue theme it
// resolved to the same blue as `created`, and on amber to the same amber
// as `started` — two bars in one cluster wearing one color, which is the
// one thing a categorical palette must never do. A user-selectable accent
// cannot safely occupy a categorical slot.
//
// The set is a validated categorical palette, not a hand-pick. Both modes
// clear every computable check under the STRICTER all-pairs pairlist —
// the grouped cluster puts all four on screen together, so neighbours-only
// isn't enough here:
//
//   light  CVD ΔE 13.0 (protan, worst pair) · normal-vision 19.6
//   dark   CVD ΔE  6.9 (protan, worst pair) · normal-vision 19.3
//
// The predecessor did NOT clear this: amber↔green measured ΔE 5.7 under
// protanopia on light — below the floor — so "started" and "closed" were
// already indistinguishable for red-blind readers on every theme.
//
// Two warnings carry obligations, both met below:
//   - dark's worst pair sits in the 6–8 band, legal only with secondary
//     encoding → the 2px gap between bars (see `barGap`) plus the legend
//     and per-bar tooltip.
//   - yellow and magenta sit under 3:1 on a light surface (a documented
//     property of these steps) → relief is the "In view — N created, N
//     started, …" summary `TaskVelocitySection` already renders under the
//     chart, so every value is readable without reading color. Keep it if
//     you touch that section.
//
// Re-run before changing any value:
//   node scripts/validate_palette.js "#2a78d6,#eda100,#008300,#e87ba4" \
//        --mode light --surface "#ffffff" --pairs all
//   node scripts/validate_palette.js "#3987e5,#c98500,#008300,#d55181" \
//        --mode dark --surface "#0b0a16" --pairs all
const SERIES = [
    { key: "created", color: { dark: "#3987e5", light: "#2a78d6" } },
    { key: "started", color: { dark: "#c98500", light: "#eda100" } },
    { key: "closed", color: { dark: "#008300", light: "#008300" } },
    { key: "updated", color: { dark: "#d55181", light: "#e87ba4" } },
] as const;

// Layout. The chart is RESPONSIVE: buckets stretch to fill the measured
// container width so a full 30-day window fits the card without
// scrolling (the earlier fixed-width version overflowed and clipped the
// most-recent days — where the activity actually is — off the right
// edge). Only when there are so many buckets that even `MIN_BUCKET_W`
// overflows do we fall back to `overflow-x: auto`, and then we
// auto-scroll to the newest (right) end so recent velocity is what you
// see first.
const MIN_BUCKET_W = 26; // still fits 4 legible bars
const MAX_BUCKET_W = 84; // don't blow a few-bucket chart up to giant bars
const CHART_H = 150;
const PLOT_H = 120; // bars area; the rest is the x-label strip
const TOP_PAD = 8;
const FALLBACK_W = 640; // width used for the first paint, before measure

// "5/4" (day) or "W of 5/4" (week) — month/day is locale-neutral enough
// for a compact axis; the tooltip carries the full ISO date.
const bucketLabel = (
    iso: string,
    granularity: VelocityGranularity,
    weekPrefix: string
): string => {
    const [, m, d] = iso.split("-");
    const md = `${Number(m)}/${Number(d)}`;
    return granularity === "week" ? `${weekPrefix} ${md}` : md;
};

// Pure-SVG grouped bar chart (no chart lib — matches BurndownSparkline).
// Each bucket renders one thin bar per series; a hover tooltip on each
// bar names the series + count, and the whole bucket column is a wider
// hover target carrying the full breakdown.
export const TaskVelocityChart = ({
    data,
    granularity,
    isDark,
    textMuted,
    textSecondary,
}: Props) => {
    const { t } = useTranslation();
    const v = t.tasks.dashboard.velocity;

    // Measure the scroll container so buckets can stretch to fill it.
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [containerW, setContainerW] = useState(FALLBACK_W);
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const measure = () => setContainerW(el.clientWidth || FALLBACK_W);
        measure();
        // Guard: ResizeObserver is absent in some test/SSR environments —
        // the one-shot measure above still gives a sane width there.
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const n = data.length;

    // Bucket width: fill the container, clamped. When even the minimum
    // overflows (very long windows) we keep MIN_BUCKET_W and scroll.
    const fits = n === 0 || n * MIN_BUCKET_W <= containerW;
    const bucketW = fits
        ? Math.min(MAX_BUCKET_W, Math.max(MIN_BUCKET_W, n > 0 ? containerW / n : MIN_BUCKET_W))
        : MIN_BUCKET_W;
    const width = Math.max(n * bucketW, 1);
    const overflowing = width > containerW + 1;

    // When the chart overflows, scroll to the newest (right) end so recent
    // velocity is visible first instead of the older, emptier left side.
    useEffect(() => {
        const el = scrollRef.current;
        if (el && overflowing) el.scrollLeft = el.scrollWidth;
    }, [overflowing, width, granularity, n]);

    // Bar geometry derived from bucket width: a centered group of 4 bars
    // occupying ~68% of the bucket.
    // 2px floor, not 1: adjacent fills need a visible surface gap to read
    // as separate marks, and it is the secondary encoding that makes the
    // dark palette's worst pair legal (see SERIES).
    const barGap = Math.max(2, bucketW * 0.05);
    const barW = Math.max(3, (bucketW * 0.68 - (SERIES.length - 1) * barGap) / SERIES.length);
    const groupW = barW * SERIES.length + barGap * (SERIES.length - 1);
    const groupPad = (bucketW - groupW) / 2;

    // Label density from the actual bucket width so labels never collide
    // (~34px each). Always label the first + last bucket.
    const labelStep = Math.max(1, Math.ceil(34 / bucketW));

    if (n === 0) {
        return (
            <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ color: textMuted }}>
                    {v.empty}
                </Typography>
            </Box>
        );
    }

    const seriesLabel: Record<(typeof SERIES)[number]["key"], string> = {
        created: v.created,
        started: v.started,
        closed: v.closed,
        updated: v.updated,
    };

    const maxVal = Math.max(
        1,
        ...data.map((p) => Math.max(p.created, p.started, p.closed, p.updated))
    );
    const yAt = (value: number) => TOP_PAD + (1 - value / maxVal) * (PLOT_H - TOP_PAD);

    return (
        <Box>
            {/* Legend — required for ≥2 series so identity is never
                color-alone. The swatch is the only place color does
                identity work; the text stays in ink tokens. */}
            <Stack direction="row" flexWrap="wrap" spacing={1.5} sx={{ mb: 1 }} useFlexGap>
                {SERIES.map((s) => (
                    <Stack key={s.key} alignItems="center" direction="row" spacing={0.5}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "2px",
                                flexShrink: 0,
                                backgroundColor: isDark ? s.color.dark : s.color.light,
                            }}
                        />
                        <Typography level="body-xs" sx={{ color: textSecondary }}>
                            {seriesLabel[s.key]}
                        </Typography>
                    </Stack>
                ))}
            </Stack>

            {/* Buckets fill this box; only a very long window overflows and
                scrolls (the page body itself must never scroll sideways). */}
            <Box ref={scrollRef} sx={{ overflowX: "auto", overflowY: "hidden", pb: 0.5 }}>
                <svg aria-label={v.title} height={CHART_H} role="img" width={width}>
                    {/* Baseline */}
                    <line
                        stroke={textMuted}
                        strokeOpacity={0.3}
                        strokeWidth={1}
                        x1={0}
                        x2={width}
                        y1={PLOT_H}
                        y2={PLOT_H}
                    />
                    {data.map((p, i) => {
                        const bucketX = i * bucketW;
                        const showLabel = i % labelStep === 0 || i === n - 1;
                        return (
                            <g key={p.date}>
                                {SERIES.map((s, si) => {
                                    const value = p[s.key];
                                    // Skip zero cells — no invisible zero-height
                                    // rects cluttering the DOM / hover targets.
                                    if (value <= 0) return null;
                                    const x = bucketX + groupPad + si * (barW + barGap);
                                    const y = yAt(value);
                                    const color = isDark ? s.color.dark : s.color.light;
                                    return (
                                        <AppTooltip
                                            key={s.key}
                                            title={fmt(v.barTooltip, {
                                                count: value,
                                                series: seriesLabel[s.key],
                                                date: p.date,
                                            })}
                                        >
                                            <rect
                                                fill={color}
                                                height={Math.max(PLOT_H - y, 2)}
                                                rx={1.5}
                                                width={barW}
                                                x={x}
                                                y={y}
                                            />
                                        </AppTooltip>
                                    );
                                })}
                                {showLabel && (
                                    <text
                                        fill={textMuted}
                                        fontSize={9}
                                        textAnchor="middle"
                                        x={bucketX + bucketW / 2}
                                        y={PLOT_H + 14}
                                    >
                                        {bucketLabel(p.date, granularity, v.weekPrefix)}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </Box>
        </Box>
    );
};
