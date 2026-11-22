import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Card, Chip, Grid, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { TaskListPanel } from "../../card";
import { AssignedMilestoneCard } from "../AssignedMilestoneCard";
import { DashboardTaskRow } from "../DashboardTaskRow";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import { TaskVelocitySection } from "../TaskVelocitySection";
import type { TaskHomeData } from "../useTaskHomeData";

type MyTasksTabProps = Pick<
    TaskHomeData,
    | "isDark"
    | "upNextSort"
    | "setUpNextSort"
    | "isViewingSelf"
    | "focusTaskIds"
    | "focusTaskUpdatedAt"
    | "focusStats"
    | "focusUpNext"
    | "focusAssignedMilestones"
    | "setDiagramMilestone"
    | "sprintNameFor"
    | "handleTaskClick"
    | "cardBg"
    | "cardBorder"
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
> &
    Pick<TaskHomeContentProps, "myself">;

export const MyTasksTab = ({
    isDark,
    upNextSort,
    setUpNextSort,
    isViewingSelf,
    focusTaskIds,
    focusTaskUpdatedAt,
    focusStats,
    focusUpNext,
    focusAssignedMilestones,
    setDiagramMilestone,
    sprintNameFor,
    handleTaskClick,
    cardBg,
    cardBorder,
    textPrimary,
    textSecondary,
    textMuted,
    myself,
}: MyTasksTabProps) => {
    const { t } = useTranslation();
    return (
        <>
            {/* ════════ Section MY: My Tasks ════════ */}
            {/* Big "nothing assigned" card only when there's truly
                nothing on this tab — no tasks AND no assigned
                milestones. With milestones present it would sit,
                contradictorily, above populated milestone cards. */}
            {focusStats.totalCount === 0 && focusAssignedMilestones.length === 0 ? (
                <EmptyState
                    data-empty="home-nothing-assigned"
                    icon={<PersonRoundedIcon />}
                    body={
                        isViewingSelf
                            ? t.tasks.dashboard.nothingAssignedBody
                            : t.tasks.dashboard.memberTasks.nothingAssignedBody
                    }
                    title={
                        isViewingSelf
                            ? t.tasks.dashboard.nothingAssignedTitle
                            : t.tasks.dashboard.memberTasks.nothingAssignedTitle
                    }
                />
            ) : (
                <Stack spacing={2}>
                    {/* KPI strip */}
                    <Grid spacing={1.5} container>
                        {(
                            [
                                {
                                    label: t.tasks.dashboard.kpiActive,
                                    value: String(focusStats.activeCount),
                                    color: "#3b82f6",
                                    icon: <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />,
                                },
                                {
                                    label: t.tasks.dashboard.kpiClosed,
                                    value: String(focusStats.closedCount),
                                    color: "#22c55e",
                                    icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />,
                                },
                                {
                                    label: t.tasks.dashboard.kpiOverdue,
                                    value: String(focusStats.overdueCount),
                                    color: "#ef4444",
                                    icon: <WarningAmberRoundedIcon sx={{ fontSize: 18 }} />,
                                },
                                {
                                    label: t.tasks.dashboard.kpiDueThisWeek,
                                    value: String(focusStats.dueThisWeekCount),
                                    color: "#f59e0b",
                                    icon: <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />,
                                },
                                {
                                    label: t.tasks.dashboard.kpiCompletion,
                                    value: `${focusStats.completionPct}%`,
                                    color: "var(--gp-brandalt-400)",
                                    icon: <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />,
                                },
                            ] as const
                        ).map((tile) => (
                            <Grid key={tile.label} md={2.4} sm={4} xs={6}>
                                <Card
                                    variant="soft"
                                    sx={{
                                        p: 2,
                                        background: isDark ? `${tile.color}1F` : `${tile.color}14`,
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
                                        <Box>
                                            <Typography
                                                level="h3"
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "1.4rem",
                                                    color: textPrimary,
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

                    {/* My velocity (personal throughput over time) */}
                    <TaskVelocitySection
                        isDark={isDark}
                        taskIds={focusTaskIds}
                        taskUpdatedAt={focusTaskUpdatedAt}
                        teamId={myself.teamId}
                        textMuted={textMuted}
                        textPrimary={textPrimary}
                        textSecondary={textSecondary}
                    />

                    {/* Up Next list */}
                    <Box>
                        <Stack
                            alignItems="center"
                            direction="row"
                            flexWrap="wrap"
                            spacing={1}
                            sx={{ mb: 1 }}
                        >
                            <Typography
                                level="body-sm"
                                sx={{
                                    color: textSecondary,
                                    fontWeight: 600,
                                }}
                            >
                                {t.tasks.dashboard.upNext.title}
                            </Typography>
                            <AppTooltip
                                title={
                                    <Box sx={{ maxWidth: 260 }}>
                                        <b>{t.tasks.dashboard.upNext.help.title}</b>
                                        <br />
                                        {t.tasks.dashboard.upNext.help.body}
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
                            {/* Sort selector — order the list by Task
                                Weight (default) or by the deadline rule. */}
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
                                    const active = upNextSort === opt.key;
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
                                            onClick={() => setUpNextSort(opt.key)}
                                        >
                                            {opt.label}
                                        </Chip>
                                    );
                                })}
                            </Stack>
                        </Stack>
                        {focusUpNext.length === 0 ? (
                            <Card
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    background: cardBg,
                                    borderColor: cardBorder,
                                }}
                            >
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: textMuted,
                                        textAlign: "center",
                                    }}
                                >
                                    {t.tasks.dashboard.upNext.allClosed}
                                </Typography>
                            </Card>
                        ) : (
                            <TaskListPanel>
                                {focusUpNext.map((task) => (
                                    <DashboardTaskRow
                                        key={task.id}
                                        sprintName={sprintNameFor(task.sprintId)}
                                        task={task}
                                        onClick={() => handleTaskClick(Number(task.id))}
                                    />
                                ))}
                            </TaskListPanel>
                        )}
                    </Box>
                </Stack>
            )}

            {/* ════════ Section: Assigned Milestones ════════ */}
            {/* Suppressed only when the WHOLE tab is empty (no tasks
                and no milestones) — the big card above already covers
                that, so we don't stack a second "empty" line under it. */}
            {(focusAssignedMilestones.length > 0 || focusStats.totalCount > 0) && (
                <Box sx={{ mt: 3 }}>
                    <Stack
                        alignItems="center"
                        direction="row"
                        flexWrap="wrap"
                        spacing={1}
                        sx={{ mb: 1.5 }}
                    >
                        <FlagRoundedIcon sx={{ fontSize: 16, color: "#f97316" }} />
                        <Typography level="body-sm" sx={{ color: textSecondary, fontWeight: 600 }}>
                            {t.tasks.dashboard.assignedMilestones.title}
                        </Typography>
                        <AppTooltip
                            title={
                                <Box sx={{ maxWidth: 260 }}>
                                    {isViewingSelf
                                        ? t.tasks.dashboard.assignedMilestones.help
                                        : t.tasks.dashboard.memberTasks.milestonesHelp}
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
                        {focusAssignedMilestones.length > 0 && (
                            <Chip size="sm" sx={{ ml: { sm: "auto" } }} variant="soft">
                                {focusAssignedMilestones.length}
                            </Chip>
                        )}
                    </Stack>
                    {focusAssignedMilestones.length === 0 ? (
                        <EmptyState
                            data-empty="home-milestones"
                            size="sm"
                            body={
                                isViewingSelf
                                    ? t.tasks.dashboard.assignedMilestones.empty
                                    : t.tasks.dashboard.memberTasks.milestonesEmpty
                            }
                        />
                    ) : (
                        <Box
                            sx={{
                                display: "grid",
                                gap: 1.5,
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, 1fr)",
                                    md: "repeat(3, 1fr)",
                                },
                            }}
                        >
                            {focusAssignedMilestones.map((m) => (
                                <AssignedMilestoneCard
                                    key={m.milestoneId}
                                    milestone={m}
                                    sprintName={sprintNameFor(m.sprintId)}
                                    onOpen={setDiagramMilestone}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </>
    );
};
