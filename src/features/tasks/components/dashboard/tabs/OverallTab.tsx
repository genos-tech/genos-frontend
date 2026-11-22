import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import { Box, Card, Chip, Grid, Stack, Table, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { BaseAvatar } from "../../../../../components/ui/avatars/BaseAvatar";
import { UserAvatar } from "../../../../../components/ui/avatars/UserAvatar";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../../i18n";
import { type } from "../../../../../theme/tokens";
import { STATUS_TONE, toneCss } from "../../../meta/taskTone";
import { taskMetaLabel } from "../../../utils/taskMeta";
import { DueBucket } from "../../../utils/taskWeight";
import { TaskListItem, TaskListPanel } from "../../card";
import { getStatusIcon } from "../../meta/statusIcons";
import { StatusLabel } from "../../meta/StatusLabel";
import { ProjectTagChip } from "../../ProjectTagChip";
import { DashboardTaskRow } from "../DashboardTaskRow";
import { STATUS_LABEL_KEYS, statusColor } from "../taskHomeHelpers";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import type { TaskHomeData } from "../useTaskHomeData";

type OverallTabProps = Pick<
    TaskHomeData,
    | "isDark"
    | "topWeightSort"
    | "setTopWeightSort"
    | "stats"
    | "assigneeWorkload"
    | "tagStats"
    | "priorityBreakdown"
    | "effortBreakdown"
    | "teamCapacity"
    | "maxCapacityTotal"
    | "topByWeight"
    | "topByWeightRows"
    | "overdueAndUpcoming"
    | "sprintNameFor"
    | "handleTaskClick"
    | "cardBg"
    | "cardBorder"
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
    | "sectionHeaderColor"
> &
    Pick<TaskHomeContentProps, "useTEM" | "myself" | "setMyself" | "useCM" | "useUISM" | "socket">;

export const OverallTab = ({
    isDark,
    topWeightSort,
    setTopWeightSort,
    stats,
    assigneeWorkload,
    tagStats,
    priorityBreakdown,
    effortBreakdown,
    teamCapacity,
    maxCapacityTotal,
    topByWeight,
    topByWeightRows,
    overdueAndUpcoming,
    sprintNameFor,
    handleTaskClick,
    cardBg,
    cardBorder,
    textPrimary,
    textSecondary,
    textMuted,
    sectionHeaderColor,
    useTEM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: OverallTabProps) => {
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

    // ── Mini distribution bar (for priority / effort) ──
    const renderDistributionCard = (
        title: string,
        icon: React.ReactNode,
        data: Record<string, number>,
        colorMap: Record<string, string>
    ) => {
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        return (
            <Card
                variant="outlined"
                sx={{
                    p: 2.5,
                    flex: 1,
                    background: cardBg,
                    borderColor: cardBorder,
                }}
            >
                <Stack spacing={2}>
                    <Stack alignItems="center" direction="row" spacing={1}>
                        {icon}
                        <Typography level="title-sm" sx={{ fontWeight: 600, color: textPrimary }}>
                            {title}
                        </Typography>
                        <Chip size="sm" sx={{ ml: "auto" }} variant="soft">
                            {total}
                            {t.tasks.dashboard.tasksSuffix}
                        </Chip>
                    </Stack>
                    {total > 0 &&
                        renderStackedBar(
                            Object.entries(data)
                                .filter(([, v]) => v > 0)
                                .map(([k, v]) => ({
                                    color: colorMap[k] || "#94a3b8",
                                    value: v,
                                })),
                            total
                        )}
                    <Stack spacing={0.75}>
                        {Object.entries(data).map(([label, count]) => (
                            <Stack
                                key={label}
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                            >
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            backgroundColor: colorMap[label] || "#94a3b8",
                                        }}
                                    />
                                    <Typography level="body-xs" sx={{ color: textSecondary }}>
                                        {label === "None"
                                            ? t.tasks.meta.none
                                            : taskMetaLabel(label, t.tasks.filters)}
                                    </Typography>
                                </Stack>
                                <Typography
                                    level="body-xs"
                                    sx={{ fontWeight: 600, color: textPrimary }}
                                >
                                    {count}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Stack>
            </Card>
        );
    };

    const priorityColors: Record<string, string> = {
        Critical: "#EF4444",
        High: "#F59E0B",
        Normal: "#3B82F6",
        Low: "#34D399",
        Minimal: "#9CA3AF",
        None: "#94a3b8",
    };

    const effortColors: Record<string, string> = {
        Extensive: "#EF4444",
        High: "#F59E0B",
        Moderate: "#3B82F6",
        Low: "#34D399",
        Minimal: "#9CA3AF",
        None: "#94a3b8",
    };

    // Due-window segments for the Team Capacity bars, in "soonest first"
    // order so a member's bar reads left-to-right as overdue → later. Same
    // red→amber→blue→gray heat language as the rest of the dashboard.
    const capacityBuckets: { key: DueBucket; color: string; label: string }[] = [
        { key: "overdue", color: "#ef4444", label: t.tasks.dashboard.capacity.overdue },
        { key: "today", color: "#f59e0b", label: t.tasks.dashboard.capacity.today },
        { key: "week", color: "#3b82f6", label: t.tasks.dashboard.capacity.week },
        { key: "later", color: "#94a3b8", label: t.tasks.dashboard.capacity.later },
        {
            key: "none",
            color: isDark ? "#4b5563" : "#cbd5e1",
            label: t.tasks.dashboard.capacity.none,
        },
    ];

    return (
        <>
            {/* ════════ Section B: Status Distribution ════════ */}
            <Box>
                <Typography
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
                    <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                    {t.tasks.dashboard.statusDistribution}
                </Typography>

                {/* Stacked bar */}
                {stats.totalTasks > 0 && (
                    <Box sx={{ mb: 2 }}>
                        {renderStackedBar(
                            [
                                {
                                    color: statusColor("Open"),
                                    value: stats.openCount,
                                },
                                {
                                    color: statusColor("WIP"),
                                    value: stats.wipCount,
                                },
                                {
                                    color: statusColor("Blocked"),
                                    value: stats.blockedCount,
                                },
                                {
                                    color: statusColor("Pending"),
                                    value: stats.pendingCount,
                                },
                                {
                                    color: statusColor("Closed"),
                                    value: stats.closedCount,
                                },
                            ],
                            stats.totalTasks
                        )}
                    </Box>
                )}

                {/* Status cards — one equal-width card per
                    status, all on a single row. A CSS grid
                    (not the 12-column MUI Grid): 12 isn't
                    divisible by 5, so the 5th card wrapped to
                    a second row. */}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "repeat(2, 1fr)",
                            md: "repeat(5, 1fr)",
                        },
                        gap: 1.5,
                    }}
                >
                    {(
                        [
                            { key: "Open", count: stats.openCount },
                            { key: "WIP", count: stats.wipCount },
                            { key: "Blocked", count: stats.blockedCount },
                            { key: "Pending", count: stats.pendingCount },
                            { key: "Closed", count: stats.closedCount },
                        ] as const
                    ).map((s) => {
                        const pct =
                            stats.totalTasks > 0
                                ? Math.round((s.count / stats.totalTasks) * 100)
                                : 0;
                        // The table's status (icon in the status color,
                        // word neutral) on a plain card: no per-status wash.
                        return (
                            <Card
                                key={s.key}
                                data-status-card={s.key}
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    borderColor: cardBorder,
                                }}
                            >
                                <Stack spacing={1}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{ gap: 1, minWidth: 0 }}
                                    >
                                        <StatusLabel iconSize={16} status={s.key} />
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: textSecondary,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {pct}%
                                        </Typography>
                                    </Stack>
                                    <Typography
                                        level="h3"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: "1.4rem",
                                            color: textPrimary,
                                        }}
                                    >
                                        {s.count}
                                    </Typography>
                                </Stack>
                            </Card>
                        );
                    })}
                </Box>
            </Box>

            {/* ════════ Section F: Overdue & Upcoming ════════ */}
            {(overdueAndUpcoming.overdue.length > 0 || overdueAndUpcoming.upcoming.length > 0) && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                    {/* Overdue */}
                    <Card
                        variant="outlined"
                        sx={{
                            flex: 1,
                            p: 2.5,
                            background: isDark ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.03)",
                            borderColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)",
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                            >
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <WarningAmberRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: "#ef4444",
                                        }}
                                    />
                                    <Typography
                                        level="title-sm"
                                        sx={{
                                            fontWeight: 600,
                                            color: "#ef4444",
                                        }}
                                    >
                                        {t.tasks.dashboard.kpiOverdue}
                                    </Typography>
                                </Stack>
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: "rgba(239,68,68,0.12)",
                                        color: "#ef4444",
                                        fontWeight: 700,
                                    }}
                                >
                                    {overdueAndUpcoming.overdue.length}
                                </Chip>
                            </Stack>
                            <Stack spacing={0}>
                                {overdueAndUpcoming.overdue.slice(0, 5).map((task) => (
                                    <TaskListItem
                                        key={task.id}
                                        status={task.effectiveStatus}
                                        task={task}
                                        untitled={t.tasks.dashboard.untitledTask}
                                        variant="compact"
                                        onOpen={() => handleTaskClick(Number(task.id))}
                                    />
                                ))}
                                {overdueAndUpcoming.overdue.length > 5 && (
                                    <Typography level="body-xs" sx={{ color: textMuted, pl: 1 }}>
                                        {fmt(t.tasks.dashboard.moreCount, {
                                            count: overdueAndUpcoming.overdue.length - 5,
                                        })}
                                    </Typography>
                                )}
                                {overdueAndUpcoming.overdue.length === 0 && (
                                    <Typography level="body-xs" sx={{ color: textMuted }}>
                                        {t.tasks.dashboard.noOverdueTasks}
                                    </Typography>
                                )}
                            </Stack>
                        </Stack>
                    </Card>

                    {/* Upcoming (due this week) */}
                    <Card
                        variant="outlined"
                        sx={{
                            flex: 1,
                            p: 2.5,
                            background: isDark ? "rgba(59,130,246,0.04)" : "rgba(59,130,246,0.03)",
                            borderColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)",
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                            >
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <CalendarMonthRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: "#3b82f6",
                                        }}
                                    />
                                    <Typography
                                        level="title-sm"
                                        sx={{
                                            fontWeight: 600,
                                            color: "#3b82f6",
                                        }}
                                    >
                                        {t.tasks.dashboard.kpiDueThisWeek}
                                    </Typography>
                                </Stack>
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: "rgba(59,130,246,0.12)",
                                        color: "#3b82f6",
                                        fontWeight: 700,
                                    }}
                                >
                                    {overdueAndUpcoming.upcoming.length}
                                </Chip>
                            </Stack>
                            <Stack spacing={0}>
                                {overdueAndUpcoming.upcoming.slice(0, 5).map((task) => (
                                    <TaskListItem
                                        key={task.id}
                                        status={task.effectiveStatus}
                                        task={task}
                                        untitled={t.tasks.dashboard.untitledTask}
                                        variant="compact"
                                        onOpen={() => handleTaskClick(Number(task.id))}
                                    />
                                ))}
                                {overdueAndUpcoming.upcoming.length > 5 && (
                                    <Typography level="body-xs" sx={{ color: textMuted, pl: 1 }}>
                                        {fmt(t.tasks.dashboard.moreCount, {
                                            count: overdueAndUpcoming.upcoming.length - 5,
                                        })}
                                    </Typography>
                                )}
                                {overdueAndUpcoming.upcoming.length === 0 && (
                                    <Typography level="body-xs" sx={{ color: textMuted }}>
                                        {t.tasks.dashboard.noTasksDueThisWeek}
                                    </Typography>
                                )}
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            )}
            {/* ════════ Section E: Priority & Effort Breakdown ════════ */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                {renderDistributionCard(
                    t.tasks.dashboard.priorityDistribution,
                    <WarningAmberRoundedIcon sx={{ fontSize: 16, color: "#f97316" }} />,
                    priorityBreakdown,
                    priorityColors
                )}
                {renderDistributionCard(
                    t.tasks.dashboard.effortDistribution,
                    <TrendingUpRoundedIcon sx={{ fontSize: 16, color: "var(--gp-brand-700)" }} />,
                    effortBreakdown,
                    effortColors
                )}
            </Stack>

            {/* ════════ Section F: Top by Weight ════════ */}
            {topByWeight.length > 0 && (
                <Box>
                    {/* Title and sort chips are siblings inside a
                        flex row: the chip Stack renders a <div>,
                        which can't live inside the <p> a Joy
                        Typography renders. */}
                    <Stack alignItems="center" direction="row" sx={{ gap: 1, mb: 0.5 }}>
                        <Typography
                            level="title-sm"
                            sx={{
                                fontWeight: 600,
                                color: sectionHeaderColor,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <WarningAmberRoundedIcon sx={{ fontSize: 16, color: "#ef4444" }} />
                            {t.tasks.dashboard.topWeight.title}
                            <AppTooltip
                                title={
                                    <Box sx={{ maxWidth: 260 }}>
                                        <b>{t.tasks.dashboard.topWeight.help.title}</b>
                                        <br />
                                        {t.tasks.dashboard.topWeight.help.body}
                                    </Box>
                                }
                            >
                                <HelpOutlineRoundedIcon
                                    sx={{
                                        fontSize: 15,
                                        color: textMuted,
                                        cursor: "help",
                                    }}
                                />
                            </AppTooltip>
                        </Typography>
                        {/* Sort selector — reorders the
                            shortlist. Same options as the
                            "Up Next" list: order by Task
                            Weight (default) or by the
                            deadline rule. */}
                        <Stack direction="row" spacing={0.5} sx={{ ml: { sm: "auto" } }}>
                            {(
                                [
                                    {
                                        key: "weight" as const,
                                        label: t.tasks.dashboard.upNext.byWeight,
                                    },
                                    {
                                        key: "urgency" as const,
                                        label: t.tasks.dashboard.upNext.byUrgency,
                                    },
                                ] as const
                            ).map((opt) => {
                                const active = topWeightSort === opt.key;
                                return (
                                    <Chip
                                        key={opt.key}
                                        size="sm"
                                        variant={active ? "solid" : "soft"}
                                        sx={{
                                            cursor: "pointer",
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            backgroundColor: active
                                                ? "var(--gp-brand-700)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.06)"
                                                  : "rgba(0,0,0,0.05)",
                                            color: active ? "white" : textSecondary,
                                            "&:hover": {
                                                backgroundColor: active
                                                    ? "var(--gp-brand-800)"
                                                    : isDark
                                                      ? "rgba(255,255,255,0.1)"
                                                      : "rgba(0,0,0,0.08)",
                                            },
                                        }}
                                        onClick={() => setTopWeightSort(opt.key)}
                                    >
                                        {opt.label}
                                    </Chip>
                                );
                            })}
                        </Stack>
                    </Stack>
                    <Typography level="body-xs" sx={{ color: textMuted, mb: 1.5 }}>
                        {t.tasks.dashboard.topWeight.subtitle}
                    </Typography>
                    <TaskListPanel>
                        {topByWeightRows.map(({ task }) => (
                            <DashboardTaskRow
                                key={task.id}
                                sprintName={sprintNameFor(task.sprintId)}
                                task={task}
                                onClick={() => handleTaskClick(Number(task.id))}
                            />
                        ))}
                    </TaskListPanel>
                </Box>
            )}

            {/* ════════ Section G: Team Capacity ════════ */}
            <Box>
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        mb: 0.5,
                        color: sectionHeaderColor,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <WorkRoundedIcon sx={{ fontSize: 16 }} />
                    {t.tasks.dashboard.capacity.title}
                    <AppTooltip
                        title={
                            <Box sx={{ maxWidth: 260 }}>
                                <b>{t.tasks.dashboard.capacity.help.title}</b>
                                <br />
                                {t.tasks.dashboard.capacity.help.body}
                            </Box>
                        }
                    >
                        <HelpOutlineRoundedIcon
                            sx={{
                                fontSize: 15,
                                color: textMuted,
                                cursor: "help",
                            }}
                        />
                    </AppTooltip>
                </Typography>
                <Typography level="body-xs" sx={{ color: textMuted, mb: 1.5 }}>
                    {t.tasks.dashboard.capacity.subtitle}
                </Typography>
                <Card
                    variant="outlined"
                    sx={{
                        p: 2,
                        background: cardBg,
                        borderColor: cardBorder,
                    }}
                >
                    {teamCapacity.length === 0 ? (
                        <EmptyState
                            body={t.tasks.dashboard.capacity.empty}
                            data-empty="home-capacity"
                            size="sm"
                        />
                    ) : (
                        <Stack spacing={2}>
                            {/* Legend */}
                            <Stack direction="row" flexWrap="wrap" gap={1.5}>
                                {capacityBuckets.map((b) => (
                                    <Stack
                                        key={b.key}
                                        alignItems="center"
                                        direction="row"
                                        spacing={0.5}
                                    >
                                        <Box
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: "2px",
                                                backgroundColor: b.color,
                                            }}
                                        />
                                        <Typography level="body-xs" sx={{ color: textSecondary }}>
                                            {b.label}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Stack>
                            {/* Per-member load rows (shared scale) */}
                            <Stack spacing={1.25}>
                                {teamCapacity.map((m) => (
                                    <Stack
                                        key={m.id}
                                        alignItems="center"
                                        direction="row"
                                        spacing={1.5}
                                    >
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            spacing={1}
                                            sx={{
                                                width: { xs: 90, sm: 150 },
                                                flexShrink: 0,
                                                minWidth: 0,
                                            }}
                                        >
                                            <UserAvatar
                                                clickable={m.id !== "__unassigned__"}
                                                fallbackInitial={m.name.charAt(0).toUpperCase()}
                                                showPulseDot={false}
                                                size={26}
                                                userId={m.id === "__unassigned__" ? null : m.id}
                                            />
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: textPrimary,
                                                    fontWeight: 500,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <bdi className="g-bidi-island">{m.name}</bdi>
                                            </Typography>
                                        </Stack>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    height: 12,
                                                    borderRadius: 6,
                                                    overflow: "hidden",
                                                    backgroundColor: isDark
                                                        ? "rgba(255,255,255,0.08)"
                                                        : "rgba(0,0,0,0.06)",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        height: "100%",
                                                        minWidth: m.total > 0 ? 6 : 0,
                                                        width: `${
                                                            maxCapacityTotal > 0
                                                                ? (m.total / maxCapacityTotal) *
                                                                  100
                                                                : 0
                                                        }%`,
                                                    }}
                                                >
                                                    {capacityBuckets.map((b) => {
                                                        const v = m.buckets[b.key];
                                                        return v > 0 ? (
                                                            <AppTooltip
                                                                key={b.key}
                                                                title={fmt(
                                                                    t.tasks.dashboard.capacity
                                                                        .effortTooltip,
                                                                    {
                                                                        label: b.label,
                                                                        points: v,
                                                                    }
                                                                )}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        width: `${(v / m.total) * 100}%`,
                                                                        backgroundColor: b.color,
                                                                    }}
                                                                />
                                                            </AppTooltip>
                                                        ) : null;
                                                    })}
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            spacing={0.75}
                                            sx={{ flexShrink: 0 }}
                                        >
                                            <AppTooltip
                                                title={t.tasks.dashboard.capacity.nearTerm}
                                            >
                                                <Chip
                                                    size="sm"
                                                    variant="soft"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "0.7rem",
                                                        minWidth: 34,
                                                        backgroundColor:
                                                            m.nearTerm > 0
                                                                ? "rgba(239,68,68,0.14)"
                                                                : "rgba(148,163,184,0.14)",
                                                        color:
                                                            m.nearTerm > 0 ? "#ef4444" : textMuted,
                                                    }}
                                                >
                                                    {m.nearTerm}
                                                </Chip>
                                            </AppTooltip>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: textMuted,
                                                    minWidth: 54,
                                                    textAlign: "right",
                                                }}
                                            >
                                                {fmt(t.tasks.dashboard.capacity.tasksCount, {
                                                    count: m.count,
                                                })}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </Card>
            </Box>

            {/* ════════ Section C: Assignee Workload ════════ */}
            {assigneeWorkload.length > 0 && (
                <Box>
                    <Typography
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
                        <PersonRoundedIcon sx={{ fontSize: 16 }} />
                        {t.tasks.dashboard.assigneeWorkload}
                    </Typography>
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
                                },
                                "& tbody tr:last-child td": {
                                    borderBottom: "none",
                                },
                            }}
                        >
                            <thead>
                                <tr>
                                    <th style={{ width: "30%" }}>{t.tasks.dashboard.member}</th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.open}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.wip}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.blocked}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.pending}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.closed}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.total}
                                    </th>
                                    <th style={{ textAlign: "center" }}>
                                        {t.tasks.dashboard.closedSprint}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {assigneeWorkload.map((a) => (
                                    <tr key={a.id}>
                                        <td>
                                            <Stack alignItems="center" direction="row" spacing={1}>
                                                {a.id !== "__unassigned__" &&
                                                useTEM.teamMemberProfiles[a.id] ? (
                                                    <AvatarWithStatus
                                                        avatarSize={26}
                                                        isYou={myself.userId === a.id}
                                                        myself={myself}
                                                        setMyself={setMyself}
                                                        showPulseDot={false}
                                                        socket={socket}
                                                        useCM={useCM}
                                                        useUISM={useUISM}
                                                        avatarUser={
                                                            useTEM.teamMemberProfiles[a.id]
                                                        }
                                                    />
                                                ) : (
                                                    <BaseAvatar
                                                        name={a.name}
                                                        size="sm"
                                                        src={a.imgPath || undefined}
                                                    />
                                                )}
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        fontWeight: 500,
                                                        color: textPrimary,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        maxWidth: 140,
                                                    }}
                                                >
                                                    <bdi className="g-bidi-island">{a.name}</bdi>
                                                </Typography>
                                            </Stack>
                                        </td>
                                        {(
                                            [
                                                {
                                                    key: "Open",
                                                    val: a.open,
                                                },
                                                {
                                                    key: "WIP",
                                                    val: a.wip,
                                                },
                                                {
                                                    key: "Blocked",
                                                    val: a.blocked,
                                                },
                                                {
                                                    key: "Pending",
                                                    val: a.pending,
                                                },
                                                {
                                                    key: "Closed",
                                                    val: a.closed,
                                                },
                                            ] as const
                                        ).map((cell) => (
                                            <td
                                                key={cell.key}
                                                style={{
                                                    textAlign: "center",
                                                }}
                                            >
                                                {cell.val > 0 ? (
                                                    <Box
                                                        component="span"
                                                        data-status-count={cell.key}
                                                        sx={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 0.5,
                                                            color: textPrimary,
                                                            // Joy icons color from --Icon-color.
                                                            "--Icon-color": toneCss(
                                                                STATUS_TONE[cell.key]
                                                            ).text,
                                                            "& > svg": {
                                                                color: toneCss(
                                                                    STATUS_TONE[cell.key]
                                                                ).text,
                                                            },
                                                            ...type("body-sm"),
                                                            fontWeight: 500,
                                                            fontVariantNumeric: "tabular-nums",
                                                        }}
                                                    >
                                                        {getStatusIcon(cell.key, 13)}
                                                        {cell.val}
                                                    </Box>
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
                                        ))}
                                        <td style={{ textAlign: "center" }}>
                                            <Typography
                                                level="body-sm"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: textPrimary,
                                                }}
                                            >
                                                {a.total}
                                            </Typography>
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {a.closedInSprint > 0 ? (
                                                <Chip
                                                    size="sm"
                                                    variant="soft"
                                                    sx={{
                                                        minWidth: 28,
                                                        backgroundColor: "rgba(34,197,94,0.12)",
                                                        color: "#22c55e",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {a.closedInSprint}
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
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                </Box>
            )}

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
                                                        fontSize="0.8rem"
                                                        isDark={isDark}
                                                        label={row.tagName}
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
