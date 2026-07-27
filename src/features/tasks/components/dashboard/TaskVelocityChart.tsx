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
// legend order. Colors are the same status-family hues the rest of the
// dashboard uses (blue intake, amber in-progress, green done, neutral
// touch) and read on both themes.
const SERIES = [
    { key: "created", color: { dark: "#60a5fa", light: "#3b82f6" } },
    { key: "started", color: { dark: "#fbbf24", light: "#f59e0b" } },
    { key: "closed", color: { dark: "#4ade80", light: "#22c55e" } },
    { key: "updated", color: { dark: "var(--gp-brandalt-400)", light: "var(--gp-brandalt-500)" } },
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
    const barGap = Math.max(1, bucketW * 0.05);
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
            {/* Legend */}
            <Stack direction="row" flexWrap="wrap" spacing={1.5} sx={{ mb: 1 }} useFlexGap>
                {SERIES.map((s) => (
                    <Stack key={s.key} alignItems="center" direction="row" spacing={0.5}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "2px",
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
