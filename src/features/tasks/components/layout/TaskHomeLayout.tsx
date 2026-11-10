import AddRoundedIcon from "@mui/icons-material/AddRounded";
import WorkspacesRoundedIcon from "@mui/icons-material/WorkspacesRounded";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { ResizeHandle } from "../../../../components/ui/ResizeHandle";
import { LayoutStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { useSyncFailure } from "../../../../services/syncStatus";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMain } from "../../../notes/chat-notes/components/ChatNoteMain";
import { MyNoteMain } from "../../../notes/my-notes/components/MyNoteMain";
import { TaskNoteMain } from "../../../notes/task-notes/components/TaskNoteMain";
import { SprintBoard } from "../board";
import { CreateTaskForm } from "../contents/CreateTaskForm";
import { TaskPreview } from "../contents/TaskPreview";
import { TaskDashboard } from "../dashboard/TaskDashboard";
import { TaskHeader } from "../header/TaskHeader";
import { TaskSidebar } from "../sidebar/TaskSidebarMain";
import { DraggableTaskTable } from "../table/DraggableTaskTable";

interface TaskHomeLayoutProps {
    // Management states
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;
    useSM: SprintMilestoneManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    // True when the tasks pane is the visible keep-alive Home. The
    // create-task panel must only mount in the ACTIVE home: every
    // CreateTaskForm mount POSTs its own empty task and writes the
    // shared `useTM.initialEmptyTaskId`, so two live instances (this
    // one + ChatHome's hidden CreateTaskPanel) race over it and the
    // loser sits on "Preparing task…" forever.
    isActiveRoute: boolean;

    // Header props
    onCreateProject: () => void;
    onManageTags: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
}

export const TaskHomeLayout = ({
    useTEM,
    usePM,
    useTM,
    useNM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    isActiveRoute,
    onCreateProject,
    onManageTags,
    onDeleteProject,
    onCloseTaskHome,
    setOpenJoinProject,
}: TaskHomeLayoutProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const projectsSync = useSyncFailure("projects");
    const ls = mode === "dark" ? LayoutStyles.dark : LayoutStyles.light;

    // The table and the board sit under the page header, which runs edge to edge
    // like every other page's: the panel's own padding moves to the box under it.
    const hasPageHeader = useTM.isTaskTableVisible || useTM.isSprintBoardVisible;
    // The dashboard draws its own PageHeader inside its scroller, so it is flush too.
    const flushMainPanel = hasPageHeader || useTM.isTaskDashboardVisible;
    const mainPanelSx = flushMainPanel
        ? { ...ls.mainPanel, px: 0, pt: 0, pb: 0, gap: 0 }
        : ls.mainPanel;
    const underHeaderSx = {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column" as const,
        gap: ls.mainPanel.gap,
        px: ls.mainPanel.px,
        pt: 1.5,
        pb: ls.mainPanel.pb,
    };

    const renderMainContent = () => (
        <Box className="MainContent" component="main" sx={mainPanelSx}>
            {useTM.isTaskDashboardVisible && (
                <TaskDashboard
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    usePM={usePM}
                    useSM={useSM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    onCloseTaskHome={onCloseTaskHome}
                />
            )}
            {hasPageHeader && (
                <>
                    <TaskHeader
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onDeleteProject={onDeleteProject}
                        onManageTags={onManageTags}
                    />
                    <Box sx={underHeaderSx}>
                        {useTM.isTaskTableVisible && (
                            <DraggableTaskTable
                                myself={myself}
                                setMyself={setMyself}
                                setTeamMembers={useTEM.setTeamMembers}
                                socket={socket}
                                teamMembers={useTEM.teamMembers}
                                useCM={useCM}
                                usePM={usePM}
                                useSM={useSM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                            />
                        )}
                        {useTM.isSprintBoardVisible && (
                            <SprintBoard
                                myself={myself}
                                setTeamMembers={useTEM.setTeamMembers}
                                socket={socket}
                                teamMemberProfiles={useTEM.teamMemberProfiles}
                                teamMembers={useTEM.teamMembers}
                                usePM={usePM}
                                useSM={useSM}
                                useTM={useTM}
                            />
                        )}
                    </Box>
                </>
            )}
        </Box>
    );

    const renderCreateTaskPanel = () => (
        <>
            <ResizeHandle className="task-resize-handle" />
            <Panel id={"4"} maxSize={80} minSize={30} order={4}>
                <Box sx={ls.mainPanel}>
                    <CreateTaskForm
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            </Panel>
        </>
    );

    const renderTaskPreviewPanel = () => (
        <>
            <ResizeHandle className="task-resize-handle" />
            <Panel defaultSize={50} id={"3"} maxSize={80} minSize={30} order={3}>
                <Box sx={ls.mainPanel}>
                    <TaskPreview
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        holdSwitchWithLoader
                    />
                </Box>
            </Panel>
        </>
    );

    // Get the currently selected tab's note type
    // This ensures we render the correct component based on the OPEN note,
    // not the sidebar category the user clicked on
    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    const renderTaskNotePanel = () => (
        <>
            <ResizeHandle className="task-resize-handle" />
            <Panel defaultSize={50} id={"7"} maxSize={100} minSize={50} order={7}>
                <Box sx={ls.mainPanel}>
                    {activeNoteType === 1 && useNM.currentMyNote && (
                        <MyNoteMain
                            isInTaskPage={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}
                    {activeNoteType === 2 && useNM.currentTaskNote && (
                        <TaskNoteMain
                            isInTaskPage={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}
                    {activeNoteType === 3 && useNM.currentChatNote && (
                        <ChatNoteMain
                            isInChatPage={false}
                            isInTaskPage={true}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}
                </Box>
            </Panel>
        </>
    );

    const renderNoProjectPanel = () => {
        // The project list never loaded: that is not "No project selected" (MIP-1298).
        if (projectsSync.failed) {
            return (
                <>
                    <ResizeHandle className="task-resize-handle" />
                    <Panel id={"6"} maxSize={100} minSize={70} order={6}>
                        <DataState
                            hasData={false}
                            loading={projectsSync.retrying}
                            skeleton={<SkeletonRows count={4} />}
                            errorState={{
                                "data-error": "no-project",
                                onRetry: projectsSync.retry,
                                title: t.common.feedback.sync.projectsFailed,
                            }}
                            error
                            fill
                        />
                    </Panel>
                </>
            );
        }
        // A new account's first screen: the shared EmptyState like every other
        // empty pane (MIP-1329). It used to be a hand-built hero (brand wash,
        // blurred glass card, glowing gradient tile, bold large button).
        return (
            <>
                <ResizeHandle className="task-resize-handle" />
                <Panel id={"6"} maxSize={100} minSize={70} order={6}>
                    <EmptyState
                        action={{
                            label: t.tasks.layout.createProject,
                            icon: <AddRoundedIcon />,
                            onClick: () => usePM.setOpenCreateProject(true),
                        }}
                        body={t.tasks.layout.noProjectBody}
                        data-empty="no-project"
                        icon={<WorkspacesRoundedIcon />}
                        title={t.tasks.layout.noProjectTitle}
                        fill
                    />
                </Panel>
            </>
        );
    };

    return (
        <PanelGroup autoSaveId="conditional" direction="horizontal" style={{ flex: 1 }}>
            <Panel defaultSize={10} id={"1"} maxSize={30} minSize={10} order={1}>
                <Box sx={ls.sidebarPanel}>
                    <TaskSidebar
                        myself={myself}
                        setOpenJoinProject={setOpenJoinProject}
                        useCM={useCM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                    />
                </Box>
            </Panel>

            {usePM.currentProject && usePM.currentProject.projectId ? (
                <>
                    {(useTM.isTaskTableVisible ||
                        useTM.isSprintBoardVisible ||
                        useTM.isTaskDashboardVisible) && (
                        <>
                            <ResizeHandle className="task-resize-handle" />
                            <Panel id={"2"} maxSize={85} minSize={30} order={2}>
                                {renderMainContent()}
                            </Panel>
                        </>
                    )}

                    {/* The panel must stay mounted across the
                        milestone→task transition. `setCurrentPreviewMilestoneId`
                        intentionally clears `currentPreviewTask` to undefined
                        so a stale task can't bleed through the milestone
                        pane; when the user then opens a regular task,
                        `currentPreviewTaskId` flips to the new id but
                        `currentPreviewTask` only repopulates after
                        `loadTask` resolves. Without including
                        `currentPreviewTaskId !== -1` in the mount guard,
                        the panel unmounts during that load and remounts
                        once data arrives — visible to the user as a
                        flash where the preview pane disappears entirely.
                        Particularly noticeable in SprintBoard when a
                        Pending-status milestone is clicked, then a
                        regular task in another column is clicked
                        rapidly afterward. */}
                    {useTM.isTaskPreviewVisible &&
                        (useTM.currentPreviewTask ||
                            useTM.currentPreviewTaskId !== -1 ||
                            useTM.currentPreviewKind === "milestone") &&
                        renderTaskPreviewPanel()}
                    {useTM.isCreatingTask.flag && isActiveRoute && renderCreateTaskPanel()}
                    {/* `isTaskNotePaneVisible`, NOT `isTaskNoteVisible`:
                        closing every note tab leaves the flag set but each
                        branch inside `renderTaskNotePanel` gated off, which
                        painted an empty half-page panel with no way to
                        close it (the close button lives in the note header
                        that didn't render). See `isNotePaneVisible`. */}
                    {useNM.isTaskNotePaneVisible &&
                        useNM.currentTaskNoteChain &&
                        renderTaskNotePanel()}
                </>
            ) : (
                renderNoProjectPanel()
            )}
        </PanelGroup>
    );
};
