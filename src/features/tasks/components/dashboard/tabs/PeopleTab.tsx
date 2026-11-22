import { useMemo } from "react";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { Box, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { UserAvatar } from "../../../../../components/ui/avatars/UserAvatar";
import {
    DashboardCard,
    SegmentedChips,
    StatStrip,
    StatTile,
    useNumberFormat,
} from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../../i18n";
import { g, type } from "../../../../../theme/tokens";
import {
    isSameMember,
    memberOptionLabel,
    renderMemberOption,
    type MemberOption,
} from "../../autocompletes/MemberPickerParts";
import { TaskListPanel } from "../../card";
import { AssignedMilestoneCard } from "../AssignedMilestoneCard";
import { DashboardTaskRow } from "../DashboardTaskRow";
import type { TaskHomeContentProps } from "../taskHomeTypes";
import { TaskVelocitySection } from "../TaskVelocitySection";
import type { TaskHomeData } from "../useTaskHomeData";
import { TeamLoadCard } from "./TeamLoadCard";

type PeopleTabProps = Pick<
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
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
    | "projectMembers"
    | "selectedMember"
    | "setSelectedMemberId"
    | "teamCapacity"
    | "maxCapacityTotal"
    | "assigneeWorkload"
    | "teamLoadOpen"
    | "teamTasksReady"
    | "setTeamLoadOpen"
> &
    Pick<TaskHomeContentProps, "myself" | "usePM">;

/**
 * The People tab (MIP-1963): My Tasks, Member's Tasks, Team Capacity and Assignee Workload in one.
 * It opens on me; the picker switches person and the layout stays the same. "Team load" (the
 * capacity bars and the status counts) sits first, collapsed until someone asks.
 */
export const PeopleTab = ({
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
    textPrimary,
    textSecondary,
    textMuted,
    projectMembers,
    selectedMember,
    setSelectedMemberId,
    teamCapacity,
    maxCapacityTotal,
    assigneeWorkload,
    teamLoadOpen,
    setTeamLoadOpen,
    teamTasksReady,
    myself,
    usePM,
}: PeopleTabProps) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const d = t.tasks.dashboard;
    const p = d.people;
    const me = useMemo<MemberOption>(
        () => ({ id: String(myself.userId), name: `${myself.userName} (${p.me})` }),
        [myself.userId, myself.userName, p.me]
    );
    const options = useMemo<MemberOption[]>(() => [me, ...projectMembers], [me, projectMembers]);
    const picked = selectedMember ?? me;
    const personName = isViewingSelf ? myself.userName : picked.name;
    const projectName = usePM.currentProject?.projectName ?? "";
    const nothing = focusStats.totalCount === 0 && focusAssignedMilestones.length === 0;

    return (
        <>
            <TeamLoadCard
                assigneeWorkload={assigneeWorkload}
                loading={teamLoadOpen && !teamTasksReady}
                maxCapacityTotal={maxCapacityTotal}
                open={teamLoadOpen}
                teamCapacity={teamCapacity}
                onToggle={setTeamLoadOpen}
            />

            <Stack
                alignItems={{ sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
            >
                <Autocomplete
                    aria-label={p.person}
                    getOptionLabel={memberOptionLabel}
                    isOptionEqualToValue={isSameMember}
                    options={options}
                    renderOption={renderMemberOption()}
                    size="sm"
                    sx={{ minWidth: { sm: 260 }, width: { xs: "100%", sm: "auto" } }}
                    value={picked}
                    startDecorator={
                        <UserAvatar showPulseDot={false} size="sm" userId={picked.id} />
                    }
                    disableClearable
                    onChange={(_, v) => setSelectedMemberId(v.id === me.id ? null : v.id)}
                />
                <Typography
                    component="h2"
                    data-testid="people-heading"
                    sx={{ ...type("title-md"), color: g.text.primary, m: 0, minWidth: 0 }}
                >
                    <bdi className="g-bidi-island">{personName}</bdi>
                    {projectName ? ` · ${projectName}` : ""}
                </Typography>
            </Stack>

            {nothing ? (
                <EmptyState
                    data-empty="home-nothing-assigned"
                    icon={<PersonRoundedIcon />}
                    body={
                        isViewingSelf ? d.nothingAssignedBody : d.memberTasks.nothingAssignedBody
                    }
                    title={
                        isViewingSelf ? d.nothingAssignedTitle : d.memberTasks.nothingAssignedTitle
                    }
                />
            ) : (
                <>
                    <StatStrip>
                        <StatTile
                            label={d.kpiActive}
                            raw={focusStats.activeCount}
                            value={nf.number(focusStats.activeCount)}
                        />
                        <StatTile
                            label={d.kpiClosed}
                            raw={focusStats.closedCount}
                            tone="success"
                            value={nf.number(focusStats.closedCount)}
                        />
                        <StatTile
                            label={d.kpiOverdue}
                            raw={focusStats.overdueCount}
                            tone="danger"
                            value={nf.number(focusStats.overdueCount)}
                        />
                        <StatTile
                            label={d.kpiDueThisWeek}
                            raw={focusStats.dueThisWeekCount}
                            value={nf.number(focusStats.dueThisWeekCount)}
                        />
                        <StatTile
                            label={d.kpiCompletion}
                            raw={focusStats.completionPct}
                            value={nf.percent(focusStats.completionPct / 100)}
                        />
                    </StatStrip>

                    <DashboardCard
                        count={nf.number(focusUpNext.length)}
                        help={d.upNext.help.body}
                        helpLabel={d.upNext.help.title}
                        title={d.upNext.title}
                        variant="flush"
                        actions={
                            <SegmentedChips
                                ariaLabel={d.upNext.title}
                                value={upNextSort}
                                options={[
                                    { value: "weight", label: d.upNext.byWeight },
                                    { value: "urgency", label: d.upNext.byUrgency },
                                ]}
                                onChange={setUpNextSort}
                            />
                        }
                    >
                        {focusUpNext.length === 0 ? (
                            <EmptyState size="xs" title={d.upNext.allClosed} />
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
                    </DashboardCard>

                    {/* Throughput of the person shown (personal velocity). */}
                    <TaskVelocitySection
                        isDark={isDark}
                        taskIds={focusTaskIds}
                        taskUpdatedAt={focusTaskUpdatedAt}
                        teamId={myself.teamId}
                        textMuted={textMuted}
                        textPrimary={textPrimary}
                        textSecondary={textSecondary}
                    />

                    <DashboardCard
                        count={nf.number(focusAssignedMilestones.length)}
                        helpLabel={d.assignedMilestones.title}
                        title={d.assignedMilestones.title}
                        help={
                            isViewingSelf
                                ? d.assignedMilestones.help
                                : d.memberTasks.milestonesHelp
                        }
                    >
                        {focusAssignedMilestones.length === 0 ? (
                            <EmptyState
                                data-empty="home-milestones"
                                size="sm"
                                body={
                                    isViewingSelf
                                        ? d.assignedMilestones.empty
                                        : d.memberTasks.milestonesEmpty
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
                    </DashboardCard>
                </>
            )}
        </>
    );
};
