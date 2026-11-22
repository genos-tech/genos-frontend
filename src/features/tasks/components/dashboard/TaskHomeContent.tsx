import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import { Box, Button, IconButton, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { PageHeader } from "../../../../components/ui/page/PageHeader";
import { fmt } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { LazyTaskDiagram } from "../../diagram/components/LazyTaskDiagram";
import { SprintConfigDialog } from "../../sprint-milestone/components/SprintConfigDialog";
import { SprintManagerDialog } from "../../sprint-milestone/components/SprintManagerDialog";
import { AgentActivityTab } from "./agentActivity/AgentActivityTab";
import { MilestoneProgressTab } from "./milestoneProgress/MilestoneProgressTab";
import { MemberTasksTab } from "./tabs/MemberTasksTab";
import { MyTasksTab } from "./tabs/MyTasksTab";
import { ProjectTab } from "./tabs/ProjectTab";
import { TodayTab } from "./tabs/TodayTab";
import { TaskHomeHeader } from "./TaskHomeHeader";
import { TaskHomeTabBar } from "./TaskHomeTabBar";
import type { TaskHomeContentProps } from "./taskHomeTypes";
import { useTaskHomeData } from "./useTaskHomeData";

export const TaskHomeContent = (props: TaskHomeContentProps) => {
    const {
        useTM,
        usePM,
        useTEM,
        useSM,
        myself,
        setMyself,
        useCM,
        useUISM,
        socket,
        onCloseTaskHome,
    } = props;
    const {
        isDark,
        t,
        projectsSync,
        tasksSync,
        projectAvatars,
        activeTab,
        setActiveTab,
        sprintConfigOpen,
        setSprintConfigOpen,
        sprintManagerOpen,
        setSprintManagerOpen,
        todayView,
        upNextSort,
        setUpNextSort,
        topWeightSort,
        setTopWeightSort,
        projectSprints,
        groupedSprints,
        selectedSprint,
        tasksUnread,
        effectiveTasks,
        stats,
        sprintStats,
        moreAnalyticsOpen,
        setMoreAnalyticsOpen,
        assigneeWorkload,
        tagStats,
        recentTasks,
        sprintTaskIds,
        sprintTaskUpdatedAt,
        sprintMembers,
        priorityBreakdown,
        effortBreakdown,
        teamCapacity,
        maxCapacityTotal,
        topByWeightRows,
        overdueAndUpcoming,
        ongoingProjectMilestones,
        myStats,
        setSelectedMemberId,
        projectMembers,
        selectedMember,
        showFocusBody,
        focusUserId,
        isViewingSelf,
        focusTaskIds,
        focusTaskUpdatedAt,
        focusStats,
        focusUpNext,
        focusAssignedMilestones,
        diagramMilestone,
        setDiagramMilestone,
        sprintNameFor,
        projectCount,
        joinedProjects,
        handleTaskClick,
        handleGoToTable,
        handleGoToBoard,
        handleCreateTask,
        handleProjectChange,
        cardBg,
        cardBorder,
        textPrimary,
        textSecondary,
        textMuted,
        sectionHeaderColor,
    } = useTaskHomeData(props);
    return (
        <>
            {usePM.currentProject?.projectId && (
                <>
                    <SprintConfigDialog
                        open={sprintConfigOpen}
                        projectId={usePM.currentProject.projectId}
                        useSM={useSM}
                        onClose={() => setSprintConfigOpen(false)}
                    />
                    <SprintManagerDialog
                        open={sprintManagerOpen}
                        projectId={usePM.currentProject.projectId}
                        useSM={useSM}
                        onClose={() => setSprintManagerOpen(false)}
                    />
                </>
            )}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    height: "100%",
                    overflow: "auto",
                    p: { xs: 2, md: 4 },
                    background: isDark
                        ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                        : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
                }}
            >
                {/* The title is the shared PageHeader (MIP-1220), the frame every other page wears, not a
                    heading inside the content. It bleeds over the container's padding and stays at the
                    top while the cards scroll under it. */}
                <Box
                    sx={{
                        position: "sticky",
                        top: { xs: -16, md: -32 },
                        zIndex: 2,
                        mx: { xs: -2, md: -4 },
                        mt: { xs: -2, md: -4 },
                        mb: 3,
                    }}
                >
                    <PageHeader
                        data-testid="task-dashboard-header"
                        title={t.tasks.dashboard.taskStats}
                        actions={
                            <>
                                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                    {fmt(t.tasks.dashboard.projectsCount, { count: projectCount })}
                                </Typography>
                                {/* The quick actions: one primary New task, two icon buttons. They used to
                                    be three tinted buttons in their own row under the tabs. */}
                                {usePM.currentProject && (
                                    // The phone's own top bar already has table, board and "+": below
                                    // sm these would show twice.
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        spacing={0.5}
                                        sx={{ display: { xs: "none", sm: "flex" } }}
                                    >
                                        <Button
                                            size="sm"
                                            startDecorator={<AddRoundedIcon />}
                                            onClick={handleCreateTask}
                                        >
                                            {t.tasks.dashboard.newTask}
                                        </Button>
                                        <AppTooltip title={t.tasks.sidebar.taskTable}>
                                            <IconButton
                                                aria-label={t.tasks.sidebar.taskTable}
                                                size="sm"
                                                variant="plain"
                                                onClick={handleGoToTable}
                                            >
                                                <FolderOpenRoundedIcon />
                                            </IconButton>
                                        </AppTooltip>
                                        <AppTooltip title={t.tasks.sidebar.sprintBoard}>
                                            <IconButton
                                                aria-label={t.tasks.sidebar.sprintBoard}
                                                size="sm"
                                                variant="plain"
                                                onClick={handleGoToBoard}
                                            >
                                                <ViewKanbanRoundedIcon />
                                            </IconButton>
                                        </AppTooltip>
                                    </Stack>
                                )}
                                {(useTM.isTaskPreviewVisible === true ||
                                    useTM.isCreatingTask.flag === true) && (
                                    <AppTooltip title={t.tasks.dashboard.closePanel}>
                                        <IconButton
                                            aria-label={t.tasks.dashboard.closePanel}
                                            color="danger"
                                            size="sm"
                                            variant="plain"
                                            onClick={onCloseTaskHome}
                                        >
                                            <CancelIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    </AppTooltip>
                                )}
                            </>
                        }
                    />
                </Box>
                <Stack spacing={3} sx={{ maxWidth: 1200, mx: "auto" }}>
                    {usePM.currentProject && (
                        <TaskHomeTabBar
                            activeTab={activeTab}
                            myStats={myStats}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    <TaskHomeHeader
                        activeTab={activeTab}
                        groupedSprints={groupedSprints}
                        handleProjectChange={handleProjectChange}
                        joinedProjects={joinedProjects}
                        myself={myself}
                        projectSprints={projectSprints}
                        projectsSync={projectsSync}
                        selectedSprint={selectedSprint}
                        setMyself={setMyself}
                        setSprintConfigOpen={setSprintConfigOpen}
                        setSprintManagerOpen={setSprintManagerOpen}
                        socket={socket}
                        useCM={useCM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />

                    {/* Only render remaining sections if a project is selected */}
                    {usePM.currentProject && (
                        <>
                            {/* The cards are counted from the project's rows. While the first read
                            is in flight, or failed with nothing cached, say so instead of
                            "No tasks" / "Nothing assigned" / zeroed charts. The member picker
                            below needs no rows and stays. */}
                            {tasksUnread && (
                                <DataState
                                    error={tasksSync.failed}
                                    hasData={false}
                                    loading={tasksSync.loading || tasksSync.retrying}
                                    skeleton={<SkeletonRows count={4} />}
                                    errorState={{
                                        "data-error": "home-tasks",
                                        onRetry: tasksSync.retry,
                                        title: t.common.feedback.sync.tasksFailed,
                                    }}
                                />
                            )}

                            {/* ════════ TAB: Milestones — progress check (MIP-1187) ════════ */}
                            {!tasksUnread && activeTab === "milestones" && (
                                <MilestoneProgressTab
                                    effectiveTasks={effectiveTasks}
                                    milestones={ongoingProjectMilestones}
                                    projectName={usePM.currentProject?.projectName}
                                    sprints={projectSprints}
                                    milestonesLoaded={
                                        usePM.currentProject?.projectId != null &&
                                        useSM.projectMilestones[usePM.currentProject.projectId] !==
                                            undefined
                                    }
                                />
                            )}

                            {/* ════════ TAB: Member's Tasks — picker + banner ════════ */}
                            {activeTab === "members" && (
                                <MemberTasksTab
                                    cardBg={cardBg}
                                    cardBorder={cardBorder}
                                    isDark={isDark}
                                    projectMembers={projectMembers}
                                    selectedMember={selectedMember}
                                    setSelectedMemberId={setSelectedMemberId}
                                    textMuted={textMuted}
                                    textPrimary={textPrimary}
                                />
                            )}

                            {/* ════════ TAB: My Tasks / Member's Tasks (shared body) ════════ */}
                            {showFocusBody && (
                                <MyTasksTab
                                    cardBg={cardBg}
                                    cardBorder={cardBorder}
                                    focusAssignedMilestones={focusAssignedMilestones}
                                    focusStats={focusStats}
                                    focusTaskIds={focusTaskIds}
                                    focusTaskUpdatedAt={focusTaskUpdatedAt}
                                    focusUpNext={focusUpNext}
                                    handleTaskClick={handleTaskClick}
                                    isDark={isDark}
                                    isViewingSelf={isViewingSelf}
                                    myself={myself}
                                    setDiagramMilestone={setDiagramMilestone}
                                    setUpNextSort={setUpNextSort}
                                    sprintNameFor={sprintNameFor}
                                    textMuted={textMuted}
                                    textPrimary={textPrimary}
                                    textSecondary={textSecondary}
                                    upNextSort={upNextSort}
                                />
                            )}

                            {/* Today (MIP-1005): what is due, what waits on me, what changed. */}
                            {!tasksUnread && activeTab === "today" && (
                                <TodayTab todayView={todayView} />
                            )}

                            {/* ════════ TAB: Overall Insights ════════ */}
                            {/* Agent Activity tab (MIP-1613): who uses which AI agent, for what. */}
                            {!tasksUnread && activeTab === "agent" && (
                                <AgentActivityTab
                                    projectAvatars={projectAvatars}
                                    projectRecords={usePM.teamProjects}
                                    teamId={myself.teamId}
                                    projects={usePM.teamProjects.map((p) => ({
                                        id: p.projectId,
                                        name: p.projectName,
                                    }))}
                                />
                            )}

                            {/* ════════ TAB: Project (Overall + Sprint, MIP-1963) ════════ */}
                            {!tasksUnread && activeTab === "project" && (
                                <ProjectTab
                                    assigneeWorkload={assigneeWorkload}
                                    cardBg={cardBg}
                                    cardBorder={cardBorder}
                                    effectiveTasks={effectiveTasks}
                                    effortBreakdown={effortBreakdown}
                                    handleCreateTask={handleCreateTask}
                                    handleTaskClick={handleTaskClick}
                                    isDark={isDark}
                                    maxCapacityTotal={maxCapacityTotal}
                                    moreAnalyticsOpen={moreAnalyticsOpen}
                                    myself={myself}
                                    overdueAndUpcoming={overdueAndUpcoming}
                                    priorityBreakdown={priorityBreakdown}
                                    recentTasks={recentTasks}
                                    sectionHeaderColor={sectionHeaderColor}
                                    selectedSprint={selectedSprint}
                                    setMoreAnalyticsOpen={setMoreAnalyticsOpen}
                                    setMyself={setMyself}
                                    setTopWeightSort={setTopWeightSort}
                                    socket={socket}
                                    sprintMembers={sprintMembers}
                                    sprintNameFor={sprintNameFor}
                                    sprintStats={sprintStats}
                                    sprintTaskIds={sprintTaskIds}
                                    sprintTaskUpdatedAt={sprintTaskUpdatedAt}
                                    stats={stats}
                                    tagStats={tagStats}
                                    teamCapacity={teamCapacity}
                                    textMuted={textMuted}
                                    textPrimary={textPrimary}
                                    textSecondary={textSecondary}
                                    topByWeightRows={topByWeightRows}
                                    topWeightSort={topWeightSort}
                                    useCM={useCM}
                                    usePM={usePM}
                                    useSM={useSM}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            )}
                        </>
                    )}
                </Stack>
            </Box>

            {/* Task graph for a clicked "Assigned Milestones" card. Lazy —
                keeps @xyflow out of the dashboard chunk (only fetched on
                first open). `highlightAssigneeId` paints the viewer's own
                tasks/subtasks in the focus color. */}
            {diagramMilestone != null &&
                diagramMilestone.taskId != null &&
                diagramMilestone.projectId != null && (
                    <LazyTaskDiagram
                        highlightAssigneeId={focusUserId ?? myself.userId}
                        myself={myself}
                        projectId={Number(diagramMilestone.projectId)}
                        rootLabel={`${diagramMilestone.displayId ?? ""} · ${diagramMilestone.title}`}
                        rootTaskId={Number(diagramMilestone.taskId)}
                        usePM={usePM}
                        useSM={useSM}
                        useTM={useTM}
                        open
                        onClose={() => setDiagramMilestone(null)}
                    />
                )}
        </>
    );
};
