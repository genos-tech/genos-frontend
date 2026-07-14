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
    { key: "updated", color: { dark: "#a78bfa", light: "#8b5cf6" } },
] as const;

// Layout constants. Bars are thin so a full 30-day window fits; when it
// doesn't, the parent's `overflow-x: auto` scrolls (each bucket keeps
// `BUCKET_W`, so bars never squash to unreadable slivers).
const BAR_W = 6;
const BAR_GAP = 2;
const BUCKET_PAD = 10;
const BUCKET_W = SERIES.length * BAR_W + (SERIES.length - 1) * BAR_GAP + BUCKET_PAD * 2;
const CHART_H = 150;
const PLOT_H = 120; // bars area; the rest is the x-label strip
const TOP_PAD = 8;

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

    if (data.length === 0) {
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
    const width = data.length * BUCKET_W;
    // Show at most ~12 x labels so they never collide; step through the
    // buckets and only render every Nth one.
    const labelStep = Math.ceil(data.length / 12);

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

            {/* Horizontal scroll so a long window never squashes the bars
                (the page body itself must never scroll sideways). */}
            <Box sx={{ overflowX: "auto", overflowY: "hidden", pb: 0.5 }}>
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
                        const bucketX = i * BUCKET_W;
                        const showLabel = i % labelStep === 0;
                        return (
                            <g key={p.date}>
                                {SERIES.map((s, si) => {
                                    const value = p[s.key];
                                    // Skip zero cells — no invisible zero-height
                                    // rects cluttering the DOM / hover targets.
                                    if (value <= 0) return null;
                                    const x = bucketX + BUCKET_PAD + si * (BAR_W + BAR_GAP);
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
                                                width={BAR_W}
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
                                        x={bucketX + BUCKET_W / 2}
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
