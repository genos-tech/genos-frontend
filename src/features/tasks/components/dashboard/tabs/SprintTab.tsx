import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import { Box, Card, Chip, Grid, LinearProgress, Stack, Typography } from "@mui/joy";

import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { SprintMilestonesSection } from "../../../sprint-milestone/components/SprintMilestonesSection";
import { TaskCard } from "../../card";
import { formatRelativeTime } from "../taskHomeHelpers";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import { TaskVelocitySection } from "../TaskVelocitySection";
import type { TaskHomeData } from "../useTaskHomeData";

type SprintTabProps = Pick<
    TaskHomeData,
    | "isDark"
    | "selectedSprint"
    | "sprintStats"
    | "recentTasks"
    | "sprintTaskIds"
    | "sprintTaskUpdatedAt"
    | "sprintMembers"
    | "handleTaskClick"
    | "handleCreateTask"
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
    | "sectionHeaderColor"
> &
    Pick<
        TaskHomeContentProps,
        | "useTM"
        | "usePM"
        | "useTEM"
        | "useSM"
        | "myself"
        | "setMyself"
        | "useCM"
        | "useUISM"
        | "socket"
    >;

export const SprintTab = ({
    isDark,
    selectedSprint,
    sprintStats,
    recentTasks,
    sprintTaskIds,
    sprintTaskUpdatedAt,
    sprintMembers,
    handleTaskClick,
    handleCreateTask,
    textPrimary,
    textSecondary,
    textMuted,
    sectionHeaderColor,
    useTM,
    usePM,
    useTEM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: SprintTabProps) => {
    const { t } = useTranslation();
    // Sprint completion percentage — closed vs total across the selected
    // sprint's milestones. Same numerator/denominator as the "{closed} /
    // {total}" label and the per-milestone progress bars below, so every
    // sprint figure on the dashboard tells one story.
    const sprintProgressPct =
        sprintStats.total > 0
            ? Math.min(100, Math.round((sprintStats.closed / sprintStats.total) * 100))
            : 0;

    return (
        <>
            {/* Sprint progress summary — moved here out of
            the pinned header so the header stays compact. */}
            <Card
                variant="soft"
                sx={{
                    p: 2.5,
                    background: isDark
                        ? "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(234,88,12,0.06) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
                }}
            >
                <Stack spacing={2}>
                    <Box>
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            sx={{ mb: 1 }}
                        >
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: textSecondary,
                                        fontWeight: 600,
                                    }}
                                >
                                    {t.tasks.dashboard.sprintProgress}
                                </Typography>
                                {selectedSprint && (
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        sx={{
                                            backgroundColor: isDark
                                                ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
                                        }}
                                    >
                                        {selectedSprint.name}
                                    </Chip>
                                )}
                            </Stack>
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: textSecondary,
                                        fontWeight: 500,
                                    }}
                                >
                                    {fmt(t.tasks.dashboard.sprintClosedOfTotal, {
                                        closed: sprintStats.closed,
                                        total: sprintStats.total,
                                    })}
                                </Typography>
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(34,197,94,0.12)"
                                            : "rgba(34,197,94,0.1)",
                                        color: "#22c55e",
                                        fontWeight: 700,
                                    }}
                                >
                                    {sprintProgressPct}%
                                </Chip>
                            </Stack>
                        </Stack>
                        <LinearProgress
                            color="success"
                            value={sprintProgressPct}
                            sx={{
                                "--LinearProgress-thickness": "8px",
                                "--LinearProgress-radius": "4px",
                                "--LinearProgress-progressRadius": "4px",
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.08)",
                            }}
                            determinate
                        />
                    </Box>
                    <Stack direction="row" flexWrap="wrap" spacing={1.5} useFlexGap>
                        <Chip
                            size="md"
                            startDecorator={<FlagRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="soft"
                            sx={{
                                backgroundColor: isDark
                                    ? "rgba(var(--gp-brand-600-rgb), 0.12)"
                                    : "rgba(var(--gp-brand-600-rgb), 0.1)",
                                color: "var(--gp-brand-500)",
                            }}
                        >
                            {fmt(t.tasks.dashboard.chipMilestones, {
                                count: sprintStats.milestones,
                            })}
                        </Chip>
                        <Chip
                            size="md"
                            startDecorator={<AssignmentRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="soft"
                            sx={{
                                backgroundColor: isDark
                                    ? "rgba(59,130,246,0.12)"
                                    : "rgba(59,130,246,0.1)",
                                color: "#3b82f6",
                            }}
                        >
                            {fmt(t.tasks.dashboard.chipTasks, {
                                count: sprintStats.total,
                            })}
                        </Chip>
                        <Chip
                            size="md"
                            variant="soft"
                            startDecorator={
                                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            }
                            sx={{
                                backgroundColor: isDark
                                    ? "rgba(34,197,94,0.12)"
                                    : "rgba(34,197,94,0.1)",
                                color: "#22c55e",
                            }}
                        >
                            {fmt(t.tasks.dashboard.chipDone, {
                                count: sprintStats.closed,
                            })}
                        </Chip>
                        <Chip
                            size="md"
                            startDecorator={<PendingActionsRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="soft"
                            sx={{
                                backgroundColor: isDark
                                    ? "rgba(251,146,60,0.12)"
                                    : "rgba(251,146,60,0.1)",
                                color: "#fb923c",
                            }}
                        >
                            {fmt(t.tasks.dashboard.chipRemaining, {
                                count: sprintStats.remaining,
                            })}
                        </Chip>
                    </Stack>
                </Stack>
            </Card>

            {/* ════════ Section A2: Sprint Milestones ════════ */}
            <SprintMilestonesSection
                myself={myself}
                projectId={usePM.currentProject?.projectId}
                selectedSprint={selectedSprint}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useSM={useSM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />

            {/* ════════ Section C: Sprint Velocity ════════ */}
            <TaskVelocitySection
                isDark={isDark}
                members={sprintMembers}
                taskIds={sprintTaskIds}
                taskUpdatedAt={sprintTaskUpdatedAt}
                teamId={myself.teamId}
                textMuted={textMuted}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                windowEnd={selectedSprint?.endDate}
                windowStart={selectedSprint?.startDate}
            />

            {/* ════════ Section D: Recently Updated Tasks (sprint-scoped) ════════ */}
            {recentTasks.length > 0 && (
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
                        <AssignmentRoundedIcon sx={{ fontSize: 16 }} />
                        {t.tasks.dashboard.recentlyUpdated}
                        <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                            {recentTasks.length}
                        </Chip>
                    </Typography>
                    <Grid spacing={1.5} container>
                        {recentTasks.map((task) => (
                            <Grid key={task.id} md={4} sm={6} xs={12}>
                                <TaskCard
                                    showAssignee={false}
                                    showTags={false}
                                    status={task.effectiveStatus}
                                    task={task}
                                    untitled={t.tasks.dashboard.untitledTask}
                                    footerEnd={
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: g.text.tertiary,
                                                ml: "auto",
                                            }}
                                        >
                                            {formatRelativeTime(task.updatedAt)}
                                        </Typography>
                                    }
                                    showStatus
                                    onOpen={() => handleTaskClick(Number(task.id))}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {/* No tasks empty state */}
            {recentTasks.length === 0 && (
                <EmptyState
                    data-empty="home-no-tasks"
                    icon={<AssignmentRoundedIcon />}
                    action={{
                        label: t.tasks.dashboard.emptyCreateTask,
                        icon: <AddRoundedIcon />,
                        onClick: handleCreateTask,
                    }}
                    body={
                        selectedSprint
                            ? t.tasks.dashboard.emptySprintSubtitle
                            : t.tasks.dashboard.emptyBacklogSubtitle
                    }
                    title={
                        selectedSprint
                            ? t.tasks.dashboard.emptySprintTitle
                            : t.tasks.dashboard.emptyBacklogTitle
                    }
                />
            )}
        </>
    );
};
