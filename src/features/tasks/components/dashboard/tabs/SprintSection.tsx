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
import { SprintMilestonesSection } from "../../../sprint-milestone/components/SprintMilestonesSection";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import type { TaskHomeData } from "../useTaskHomeData";

type SprintSectionProps = Pick<
    TaskHomeData,
    "selectedSprint" | "sprintStats" | "recentTasks" | "handleCreateTask"
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

/**
 * The sprint part of the Project tab (MIP-1963): the progress card and the sprint's milestones.
 * The Sprint tab's velocity, recent-task grid and empty state moved to the Project tab and its
 * "More analytics"; the milestones merge into the Milestones tab in a later PR.
 */
export const SprintSection = ({
    selectedSprint,
    sprintStats,
    recentTasks,
    handleCreateTask,
    usePM,
    useSM,
    useTM,
    useTEM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: SprintSectionProps) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    // Closed vs total across the selected sprint's milestones: the same numerator and
    // denominator as the per-milestone bars below, so every sprint figure tells one story.
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
        </>
    );
};
