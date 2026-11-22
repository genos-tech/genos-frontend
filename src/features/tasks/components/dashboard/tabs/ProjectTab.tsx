import { useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Button, Typography } from "@mui/joy";

import {
    DashboardCard,
    SegmentedChips,
    StatStrip,
    StatTile,
    useNumberFormat,
} from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../../i18n";
import { g, type } from "../../../../../theme/tokens";
import { TaskListPanel } from "../../card";
import { DashboardTaskRow } from "../DashboardTaskRow";
import { MoreAnalytics } from "../MoreAnalytics";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import { TaskVelocitySection } from "../TaskVelocitySection";
import type { TaskHomeData } from "../useTaskHomeData";
import { ProjectAnalytics } from "./OverallTab";
import { SprintSection } from "./SprintSection";

type ProjectTabProps = Pick<
    TaskHomeData,
    | "isDark"
    | "stats"
    | "overdueAndUpcoming"
    | "topByWeightRows"
    | "topWeightSort"
    | "setTopWeightSort"
    | "sprintNameFor"
    | "handleTaskClick"
    | "handleCreateTask"
    | "selectedSprint"
    | "sprintStats"
    | "sprintMembers"
    | "sprintTaskIds"
    | "sprintTaskUpdatedAt"
    | "recentTasks"
    | "effectiveTasks"
    | "moreAnalyticsOpen"
    | "setMoreAnalyticsOpen"
    | "assigneeWorkload"
    | "tagStats"
    | "priorityBreakdown"
    | "effortBreakdown"
    | "teamCapacity"
    | "maxCapacityTotal"
    | "cardBg"
    | "cardBorder"
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

type AttentionList = "overdue" | "week" | "weight";
const VISIBLE_ROWS = 5;

/**
 * The Project tab (MIP-1963): Overall Insights and Sprint Insights in one. A one-line summary,
 * a stat strip, "Needs attention" (overdue / due this week / top by weight in one list), the
 * sprint card and milestones, throughput, and the rest of the analytics behind "More analytics".
 * Counts in the summary and strip cover the whole project; the sprint card, sprint milestones
 * and throughput follow the selected sprint, as the Sprint tab did.
 */
export const ProjectTab = ({
    stats,
    overdueAndUpcoming,
    topByWeightRows,
    topWeightSort,
    setTopWeightSort,
    sprintNameFor,
    handleTaskClick,
    handleCreateTask,
    selectedSprint,
    sprintStats,
    sprintMembers,
    sprintTaskIds,
    sprintTaskUpdatedAt,
    recentTasks,
    effectiveTasks,
    moreAnalyticsOpen,
    setMoreAnalyticsOpen,
    isDark,
    textPrimary,
    textSecondary,
    textMuted,
    useTM,
    usePM,
    useTEM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    ...analytics
}: ProjectTabProps) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const [list, setList] = useState<AttentionList>("overdue");
    const [expanded, setExpanded] = useState(false);
    const d = t.tasks.dashboard;

    if (effectiveTasks.length === 0) {
        return (
            <EmptyState
                body={selectedSprint ? d.emptySprintSubtitle : d.emptyBacklogSubtitle}
                data-empty="home-no-tasks"
                icon={<AssignmentRoundedIcon />}
                title={selectedSprint ? d.emptySprintTitle : d.emptyBacklogTitle}
                action={{
                    label: d.emptyCreateTask,
                    icon: <AddRoundedIcon />,
                    onClick: handleCreateTask,
                }}
            />
        );
    }

    const overdueCount = overdueAndUpcoming.overdue.length;
    const weekCount = overdueAndUpcoming.upcoming.length;
    const rows =
        list === "overdue"
            ? overdueAndUpcoming.overdue
            : list === "week"
              ? overdueAndUpcoming.upcoming
              : topByWeightRows.map((r) => r.task);
    const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
    const pick = (next: AttentionList) => {
        setList(next);
        setExpanded(false);
    };
    const emptyText =
        list === "overdue"
            ? d.noOverdueTasks
            : list === "week"
              ? d.noTasksDueThisWeek
              : d.project.emptyTop;

    return (
        <>
            <Typography
                component="p"
                data-testid="project-summary"
                sx={{ ...type("h4"), color: g.text.primary, m: 0 }}
            >
                {fmt(d.project.summary, {
                    closed: nf.number(stats.closedCount),
                    total: nf.number(stats.totalTasks),
                    overdue: nf.number(overdueCount),
                    blocked: nf.number(stats.blockedCount),
                })}
            </Typography>

            <StatStrip>
                <StatTile
                    label={d.kpiClosed}
                    raw={stats.closedCount}
                    sub={`/ ${nf.number(stats.totalTasks)}`}
                    tone="success"
                    value={nf.number(stats.closedCount)}
                />
                <StatTile
                    label={d.kpiOverdue}
                    pressed={list === "overdue"}
                    raw={overdueCount}
                    tone="danger"
                    value={nf.number(overdueCount)}
                    onClick={() => pick("overdue")}
                />
                <StatTile
                    label={t.tasks.filters.blocked}
                    raw={stats.blockedCount}
                    tone="warning"
                    value={nf.number(stats.blockedCount)}
                />
                <StatTile
                    label={d.kpiDueThisWeek}
                    pressed={list === "week"}
                    raw={weekCount}
                    value={nf.number(weekCount)}
                    onClick={() => pick("week")}
                />
            </StatStrip>

            <DashboardCard
                count={nf.number(rows.length)}
                subtitle={list === "weight" ? d.topWeight.subtitle : undefined}
                title={d.project.attentionTitle}
                variant="flush"
                actions={
                    <>
                        {list === "weight" && (
                            <SegmentedChips
                                ariaLabel={d.topWeight.title}
                                value={topWeightSort}
                                options={[
                                    { value: "weight", label: d.upNext.byWeight },
                                    { value: "urgency", label: d.upNext.byUrgency },
                                ]}
                                onChange={setTopWeightSort}
                            />
                        )}
                        <SegmentedChips
                            ariaLabel={d.project.attentionFilter}
                            value={list}
                            options={[
                                { value: "overdue", label: d.kpiOverdue },
                                { value: "week", label: d.kpiDueThisWeek },
                                { value: "weight", label: d.topWeight.title },
                            ]}
                            onChange={pick}
                        />
                    </>
                }
            >
                {rows.length === 0 ? (
                    <Typography sx={{ ...type("body-sm"), color: g.text.secondary, px: 2 }}>
                        {emptyText}
                    </Typography>
                ) : (
                    <TaskListPanel>
                        {shown.map((task) => (
                            <DashboardTaskRow
                                key={task.id}
                                sprintName={sprintNameFor(task.sprintId)}
                                task={task}
                                onClick={() => handleTaskClick(Number(task.id))}
                            />
                        ))}
                    </TaskListPanel>
                )}
                {rows.length > VISIBLE_ROWS && (
                    <Button
                        size="sm"
                        sx={{ mx: 1.5, mt: 0.5 }}
                        variant="plain"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded
                            ? d.project.showLess
                            : fmt(d.project.showAll, { count: nf.number(rows.length) })}
                    </Button>
                )}
            </DashboardCard>

            <SprintSection
                myself={myself}
                selectedSprint={selectedSprint}
                setMyself={setMyself}
                socket={socket}
                sprintStats={sprintStats}
                useCM={useCM}
                usePM={usePM}
                useSM={useSM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />

            {/* Mounted once, outside "More analytics": opening or closing it never remounts the
                chart or re-requests the velocity. */}
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

            <MoreAnalytics
                open={moreAnalyticsOpen}
                recentTasks={recentTasks}
                onOpenTask={handleTaskClick}
                onToggle={setMoreAnalyticsOpen}
            >
                <ProjectAnalytics
                    {...analytics}
                    isDark={isDark}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    stats={stats}
                    textMuted={textMuted}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </MoreAnalytics>
        </>
    );
};
