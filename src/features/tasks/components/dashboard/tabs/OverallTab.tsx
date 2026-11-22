/**
 * "More analytics" body of the Project tab (MIP-1963): status, priority and effort bars, then
 * Tag Insights. Team Capacity and Assignee Workload moved to the People tab's "Team load". The
 * overdue / due-this-week / top-by-weight lists and the status cards moved into the Project tab's Needs attention and stat strip.
 */
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, Card, Chip, Grid, Stack, Table, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import {
    DashboardCard,
    DashboardGrid,
    ProportionBar,
    useNumberFormat,
    type ProportionSegment,
} from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { EFFORT_TONE, PRIORITY_TONE, STATUS_TONE, type Tone } from "../../../meta/taskTone";
import { taskMetaLabel } from "../../../utils/taskMeta";
import { ProjectTagChip } from "../../ProjectTagChip";
import { STATUS_LABEL_KEYS, statusColor } from "../taskHomeHelpers";
import type { TaskHomeData } from "../useTaskHomeData";

type ProjectAnalyticsProps = Pick<
    TaskHomeData,
    | "isDark"
    | "stats"
    | "tagStats"
    | "priorityBreakdown"
    | "effortBreakdown"
    | "cardBg"
    | "cardBorder"
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
    | "sectionHeaderColor"
>;

export const ProjectAnalytics = ({
    isDark,
    stats,
    tagStats,
    priorityBreakdown,
    effortBreakdown,
    cardBg,
    cardBorder,
    textPrimary,
    textSecondary,
    textMuted,
    sectionHeaderColor,
}: ProjectAnalyticsProps) => {
    const { t } = useTranslation();
    // ── Stacked bar helper ──
    const renderStackedBar = (segments: { color: string; value: number }[], total: number) => (
        <Box
            sx={{
                display: "flex",
                height: 10,
                borderRadius: 5,
                overflow: "hidden",
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
        >
            {segments.map((seg, i) =>
                seg.value > 0 ? (
                    <AppTooltip key={i} title={`${Math.round((seg.value / total) * 100)}%`}>
                        <Box
                            sx={{
                                width: `${(seg.value / total) * 100}%`,
                                backgroundColor: seg.color,
                                transition: "width 0.3s ease",
                            }}
                        />
                    </AppTooltip>
                ) : null
            )}
        </Box>
    );

    const nf = useNumberFormat();
    const statusSegments: ProportionSegment[] = [
        { key: "Open", n: stats.openCount },
        { key: "WIP", n: stats.wipCount },
        { key: "Blocked", n: stats.blockedCount },
        { key: "Pending", n: stats.pendingCount },
        { key: "Closed", n: stats.closedCount },
    ].map(({ key, n }) => ({
        key,
        label: taskMetaLabel(key, t.tasks.filters) || key,
        value: n,
        tone: STATUS_TONE[key as keyof typeof STATUS_TONE],
        // "3 · 60%": the old status cards showed each share.
        display: `${nf.number(n)} · ${nf.percent(stats.totalTasks > 0 ? n / stats.totalTasks : 0)}`,
    }));
    const levelSegments = (
        data: Record<string, number>,
        tones: Record<string, Tone>
    ): ProportionSegment[] =>
        Object.entries(data).map(([key, n]) => ({
            key,
            label: key === "None" ? t.tasks.meta.none : taskMetaLabel(key, t.tasks.filters),
            value: n,
            tone: tones[key] ?? "neutral",
            display: nf.number(n),
        }));
    const prioritySegments = levelSegments(priorityBreakdown, PRIORITY_TONE);
    const effortSegments = levelSegments(effortBreakdown, EFFORT_TONE);
    const prioritySum = prioritySegments.reduce((a, x) => a + x.value, 0);
    const effortSum = effortSegments.reduce((a, x) => a + x.value, 0);
    // "Open 3, WIP 2, Closed 0" for assistive tech: the numbers are never hover-only.
    const segmentsLabel = (segs: ProportionSegment[]) =>
        segs.map((x) => `${x.label} ${x.display ?? x.value}`).join(", ");

    return (
        <>
            {/* ════════ Status, priority and effort (MIP-1963): one ProportionBar each ════════ */}
            <DashboardGrid>
                <DashboardCard title={t.tasks.dashboard.statusDistribution}>
                    <ProportionBar
                        ariaLabel={segmentsLabel(statusSegments)}
                        segments={statusSegments}
                    />
                </DashboardCard>
                <DashboardCard
                    count={nf.number(prioritySum)}
                    title={t.tasks.dashboard.priorityDistribution}
                >
                    <ProportionBar
                        ariaLabel={segmentsLabel(prioritySegments)}
                        segments={prioritySegments}
                    />
                </DashboardCard>
                <DashboardCard
                    count={nf.number(effortSum)}
                    title={t.tasks.dashboard.effortDistribution}
                >
                    <ProportionBar
                        ariaLabel={segmentsLabel(effortSegments)}
                        segments={effortSegments}
                    />
                </DashboardCard>
            </DashboardGrid>

            {/* ════════ Tag Insights ════════ */}
            <Box>
                <Typography
                    component="div"
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        mb: 2,
                        color: sectionHeaderColor,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <LocalOfferRoundedIcon sx={{ fontSize: 16 }} />
                    {t.tasks.dashboard.tagInsights}
                    <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                        {tagStats.rows.length}
                    </Chip>
                </Typography>

                {tagStats.rows.length === 0 ? (
                    <EmptyState
                        body={t.tasks.dashboard.tags.emptyBody}
                        data-empty="home-no-tags"
                        icon={<LocalOfferRoundedIcon />}
                        title={t.tasks.dashboard.tags.emptyTitle}
                    />
                ) : (
                    <Stack spacing={2}>
                        {/* Summary KPI tiles */}
                        <Grid spacing={1.5} container>
                            {(
                                [
                                    {
                                        label: t.tasks.dashboard.tags.inUse,
                                        value: String(tagStats.rows.length),
                                        color: "#ec4899",
                                        icon: <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />,
                                    },
                                    {
                                        label: t.tasks.dashboard.tags.taggedItems,
                                        value: String(tagStats.taggedCount),
                                        color: "#3b82f6",
                                        icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                                    },
                                    {
                                        label: t.tasks.dashboard.tags.coverage,
                                        value: `${tagStats.coveragePct}%`,
                                        color: "#22c55e",
                                        icon: <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />,
                                    },
                                    {
                                        label: t.tasks.dashboard.tags.mostUsed,
                                        value: tagStats.rows[0]?.tagName ?? "—",
                                        color:
                                            tagStats.rows[0]?.tagColor ?? "var(--gp-brandalt-400)",
                                        icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
                                    },
                                ] as const
                            ).map((tile) => (
                                <Grid key={tile.label} md={3} sm={6} xs={6}>
                                    <Card
                                        variant="soft"
                                        sx={{
                                            p: 2,
                                            height: "100%",
                                            background: isDark
                                                ? `${tile.color}1F`
                                                : `${tile.color}14`,
                                            border: "1px solid",
                                            borderColor: cardBorder,
                                            transition: "transform 0.2s ease",
                                            "&:hover": {
                                                transform: "translateY(-2px)",
                                            },
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Box
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: tile.color,
                                                    backgroundColor: isDark
                                                        ? "rgba(255,255,255,0.06)"
                                                        : "rgba(255,255,255,0.8)",
                                                }}
                                            >
                                                {tile.icon}
                                            </Box>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography
                                                    level="h3"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "1.4rem",
                                                        color: textPrimary,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {tile.value}
                                                </Typography>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: textSecondary,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {tile.label}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>

                        {/* Status legend — the per-row Status bars
                            are unlabeled, so this maps each color to
                            its status. Same colors the bars use. */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            flexWrap="wrap"
                            spacing={1.5}
                            sx={{ px: 0.5 }}
                            useFlexGap
                        >
                            <Typography level="body-xs" sx={{ color: textMuted, fontWeight: 600 }}>
                                {t.tasks.dashboard.tags.status}
                            </Typography>
                            {(["Open", "WIP", "Blocked", "Pending", "Closed"] as const).map(
                                (s) => (
                                    <Stack
                                        key={s}
                                        alignItems="center"
                                        direction="row"
                                        spacing={0.5}
                                    >
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "3px",
                                                backgroundColor: statusColor(s),
                                            }}
                                        />
                                        <Typography level="body-xs" sx={{ color: textSecondary }}>
                                            {
                                                t.tasks.dashboard.statusLabels[
                                                    STATUS_LABEL_KEYS[s] ?? "open"
                                                ]
                                            }
                                        </Typography>
                                    </Stack>
                                )
                            )}
                        </Stack>

                        {/* Per-tag breakdown table */}
                        <Card
                            variant="outlined"
                            sx={{
                                background: cardBg,
                                borderColor: cardBorder,
                                overflow: "auto",
                            }}
                        >
                            <Table
                                size="sm"
                                sx={{
                                    "& thead th": {
                                        backgroundColor: "transparent",
                                        color: textSecondary,
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        borderBottom: "1px solid",
                                        borderColor: cardBorder,
                                        py: 1,
                                    },
                                    "& tbody td": {
                                        borderBottom: "1px solid",
                                        borderColor: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.04)",
                                        py: 1.25,
                                        verticalAlign: "middle",
                                    },
                                    "& tbody tr:last-child td": {
                                        borderBottom: "none",
                                    },
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th style={{ width: "26%" }}>
                                            {t.tasks.dashboard.tags.colTag}
                                        </th>
                                        <th
                                            style={{
                                                width: 64,
                                                textAlign: "center",
                                            }}
                                        >
                                            {t.tasks.dashboard.tags.colItems}
                                        </th>
                                        <th style={{ width: "42%" }}>
                                            {t.tasks.dashboard.tags.status}
                                        </th>
                                        <th
                                            style={{
                                                width: 84,
                                                textAlign: "center",
                                            }}
                                        >
                                            {t.tasks.dashboard.tags.colProgress}
                                        </th>
                                        <th
                                            style={{
                                                width: 76,
                                                textAlign: "center",
                                            }}
                                        >
                                            {t.tasks.dashboard.kpiOverdue}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tagStats.rows.map((row) => {
                                        const pct =
                                            row.total > 0
                                                ? Math.round((row.closed / row.total) * 100)
                                                : 0;
                                        return (
                                            <tr key={row.tagName}>
                                                <td>
                                                    <ProjectTagChip
                                                        isDark={isDark}
                                                        label={row.tagName}
                                                        size="md"
                                                        tagColor={row.tagColor}
                                                    />
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    <Typography
                                                        level="body-sm"
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: textPrimary,
                                                        }}
                                                    >
                                                        {row.total}
                                                    </Typography>
                                                </td>
                                                <td>
                                                    {renderStackedBar(
                                                        [
                                                            {
                                                                color: statusColor("Open"),
                                                                value: row.open,
                                                            },
                                                            {
                                                                color: statusColor("WIP"),
                                                                value: row.wip,
                                                            },
                                                            {
                                                                color: statusColor("Blocked"),
                                                                value: row.blocked,
                                                            },
                                                            {
                                                                color: statusColor("Pending"),
                                                                value: row.pending,
                                                            },
                                                            {
                                                                color: statusColor("Closed"),
                                                                value: row.closed,
                                                            },
                                                        ],
                                                        row.total
                                                    )}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {/* Completion %
                                                        (closed / total).
                                                        The bar was dropped
                                                        — the Status column's
                                                        green segment already
                                                        shows progress. */}
                                                    <Typography
                                                        level="body-sm"
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: textPrimary,
                                                        }}
                                                    >
                                                        {pct}%
                                                    </Typography>
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    {row.overdue > 0 ? (
                                                        <Chip
                                                            size="sm"
                                                            variant="soft"
                                                            sx={{
                                                                minWidth: 28,
                                                                backgroundColor:
                                                                    "rgba(239,68,68,0.12)",
                                                                color: "#ef4444",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {row.overdue}
                                                        </Chip>
                                                    ) : (
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: textMuted,
                                                            }}
                                                        >
                                                            -
                                                        </Typography>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </Card>
                    </Stack>
                )}
            </Box>
        </>
    );
};
