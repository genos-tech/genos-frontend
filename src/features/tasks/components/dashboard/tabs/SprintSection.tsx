import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Typography } from "@mui/joy";

import {
    DashboardCard,
    ProportionBar,
    useNumberFormat,
} from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../../i18n";
import { g, type } from "../../../../../theme/tokens";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import type { TaskHomeData } from "../useTaskHomeData";
import { MilestonesAtRiskCard } from "./MilestonesAtRiskCard";

type SprintSectionProps = Pick<
    TaskHomeData,
    | "selectedSprint"
    | "sprintStats"
    | "sprintMilestones"
    | "recentTasks"
    | "handleCreateTask"
    | "effectiveTasks"
> &
    Pick<TaskHomeContentProps, "useTM"> & {
        onShowAllMilestones: () => void;
    };

/**
 * The sprint part of the Project tab (MIP-1963): the progress card and the milestones at risk.
 * The Sprint tab's velocity, recent-task grid and empty state moved to the Project tab and its
 * "More analytics"; its "Milestones in sprint" list is now the Milestones tab.
 */
export const SprintSection = ({
    selectedSprint,
    sprintStats,
    sprintMilestones,
    recentTasks,
    handleCreateTask,
    effectiveTasks,
    useTM,
    onShowAllMilestones,
}: SprintSectionProps) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const openMilestone = (milestoneId: number) => {
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
    };
    // Closed vs total across the selected sprint's milestones (the server's counts, sub-tasks
    // included). The milestone card's bars count the dashboard's own rows, so the two can differ.
    const pct = sprintStats.total > 0 ? Math.min(1, sprintStats.closed / sprintStats.total) : 0;
    const segments = [
        {
            key: "closed",
            label: t.tasks.dashboard.kpiClosed,
            value: sprintStats.closed,
            tone: "success" as const,
            display: nf.number(sprintStats.closed),
        },
        {
            key: "remaining",
            label: t.tasks.dashboard.project.sprintRemaining,
            value: sprintStats.remaining,
            tone: "neutral" as const,
            display: nf.number(sprintStats.remaining),
        },
    ];
    return (
        <>
            <DashboardCard
                count={selectedSprint?.name}
                title={t.tasks.dashboard.sprintProgress}
                actions={
                    <Typography
                        sx={{
                            ...type("body-sm"),
                            color: g.text.secondary,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {fmt(t.tasks.dashboard.sprintClosedOfTotal, {
                            closed: nf.number(sprintStats.closed),
                            total: nf.number(sprintStats.total),
                        })}{" "}
                        · {nf.percent(pct)}
                    </Typography>
                }
                subtitle={`${fmt(t.tasks.dashboard.chipMilestones, {
                    count: sprintStats.milestones,
                })} · ${fmt(t.tasks.dashboard.chipTasks, { count: sprintStats.total })}`}
            >
                <ProportionBar
                    ariaLabel={segments.map((s) => `${s.label} ${s.display}`).join(", ")}
                    segments={segments}
                />
            </DashboardCard>
            {/* The selected sprint (or the backlog) has no tasks: say so, with the way out. */}
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
            <MilestonesAtRiskCard
                effectiveTasks={effectiveTasks}
                milestones={sprintMilestones}
                onOpenMilestone={openMilestone}
                onShowAll={onShowAllMilestones}
            />
        </>
    );
};
