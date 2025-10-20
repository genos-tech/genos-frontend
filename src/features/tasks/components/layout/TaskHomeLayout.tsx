import AddIcon from "@mui/icons-material/Add";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { TaskType } from "../../../../types/tasks";
import { TaskNoteMain } from "../../../notes/task-notes/components/TaskNoteMain";
import { CreateTaskForm } from "../contents/CreateTaskForm";
import { TaskPreview } from "../contents/TaskPreview";
import { TaskDashboard } from "../dashboard/TaskDashboard";
import { TaskHomeHeader } from "../header/TaskHomeHeader";
import { TaskSidebar } from "../sidebar/TaskSidebarMain";
import { ProjectTaskTable } from "../table/TaskTable";

interface TaskHomeLayoutProps {
    // Layout state
    isTaskHomeVisible: boolean;
    isDashboardVisible: boolean;
    displayTaskType: TaskType;

    // Management states
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
    NM: NoteManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
    openingService: number;
    allChats: AllChatProps[];
    funcSetAllChats: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    socket: Socket | null;

    // Setters
    setCurrentFilterName: (name: string) => void;
    setFilterBy: (filter: number) => void;
    setSelectedTagForFiltering: (value: string | undefined) => void;
    setIsTaskHomeVisible: (visible: boolean) => void;
    setIsDashboardVisible: (visible: boolean) => void;

    // Header props
    teamTaskSearchOptions: any[];
    loading: boolean;
    openSearch: boolean;
    setOpenSearch: (open: boolean) => void;
    onSearchChange: (value: any) => void;
    onCreateTask: () => void;
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
}

export const TaskHomeLayout = ({
    isTaskHomeVisible,
    isDashboardVisible,
    displayTaskType,
    TEM,
    PM,
    TM,
    NM,
    myself,
    setMyself,
    setCurrentMainChat,
    setOpeningService,
    openingService,
    allChats,
    funcSetAllChats,
    moveToSpecificChat,
    socket,
    setCurrentFilterName,
    setFilterBy,
    setSelectedTagForFiltering,
    setIsTaskHomeVisible,
    setIsDashboardVisible,
    teamTaskSearchOptions,
    loading,
    openSearch,
    setOpenSearch,
    onSearchChange,
    onCreateTask,
    onCreateProject,
    onCreateTag,
    onDeleteProject,
    onCloseTaskHome,
}: TaskHomeLayoutProps) => {
    const { mode } = useColorScheme();

    const renderResizeHandle = () => (
        <PanelResizeHandle
            className="task-resize-handle"
            style={{
                width: "1px",
                backgroundColor: mode === "dark" ? "black" : "white",
                transition: "all 0.3s ease-in-out",
                cursor: "col-resize",
            }}
        />
    );

    const renderMainContent = () => (
        <Box
            className="MainContent"
            component="main"
            sx={{
                px: { xs: 1, md: 2 },
                pt: {
                    xs: "calc(12px + var(--Header-height))",
                    sm: "calc(12px + var(--Header-height))",
                    md: 3,
                },
                pb: { xs: 2, sm: 2, md: 3 },
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                height: "100dvh",
                overflow: "hidden",
                gap: 1,
                borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
            }}
        >
            {isDashboardVisible && <TaskDashboard />}
            {isTaskHomeVisible && (
                <>
                    <TaskHomeHeader
                        allChats={allChats}
                        currentProject={PM.currentProject}
                        funcSetAllChats={funcSetAllChats}
                        isCreatingTask={TM.isCreatingTask.flag}
                        isTaskPreviewVisible={TM.isTaskPreviewVisible}
                        loading={loading}
                        myself={myself}
                        openSearch={openSearch}
                        setCurrentMainChat={setCurrentMainChat}
                        setMyself={setMyself}
                        setOpeningService={setOpeningService}
                        setOpenSearch={setOpenSearch}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamTaskSearchOptions={teamTaskSearchOptions}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onCreateTag={onCreateTag}
                        onCreateTask={onCreateTask}
                        onDeleteProject={onDeleteProject}
                        onSearchChange={onSearchChange}
                    />
                    <ProjectTaskTable
                        currentProject={PM.currentProject}
                        displayTaskType={displayTaskType}
                        myself={myself}
                        setTeamMembers={TEM.setTeamMembers}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        TM={TM}
                    />
                </>
            )}
        </Box>
    );

    const renderCreateTaskPanel = () => (
        <>
            {renderResizeHandle()}
            <Panel id={"4"} maxSize={80} minSize={30} order={4}>
                <Box
                    sx={{
                        px: { xs: 1, md: 2 },
                        pt: {
                            xs: "calc(12px + var(--Header-height))",
                            sm: "calc(12px + var(--Header-height))",
                            md: 2,
                        },
                        pb: { xs: 2, sm: 2, md: 3 },
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        height: "100dvh",
                        gap: 1,
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <CreateTaskForm
                        chatType={-1}
                        currentMainChat={undefined}
                        currentThreadChat={undefined}
                        moveToSpecificChat={moveToSpecificChat}
                        myself={myself}
                        openingService={openingService}
                        parentTaskId={TM.isCreatingTask.parentTaskId}
                        PM={PM}
                        rootTaskId={TM.isCreatingTask.rootTaskId}
                        setCurrentMainChat={setCurrentMainChat}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setMyself={setMyself}
                        setOpeningService={setOpeningService}
                        setTeamMembers={TEM.setTeamMembers}
                        socket={socket}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        TM={TM}
                    />
                </Box>
            </Panel>
        </>
    );

    const renderTaskPreviewPanel = () => (
        <>
            {renderResizeHandle()}
            <Panel defaultSize={50} id={"3"} maxSize={80} minSize={30} order={3}>
                <Box
                    sx={{
                        px: { xs: 1, md: 2 },
                        pt: {
                            xs: "calc(12px + var(--Header-height))",
                            sm: "calc(12px + var(--Header-height))",
                            md: 2,
                        },
                        pb: { xs: 2, sm: 2, md: 3 },
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        height: "100dvh",
                        gap: 1,
                    }}
                >
                    <TaskPreview
                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                        isTaskNoteVisible={NM.isTaskNoteVisible}
                        moveToSpecificChat={moveToSpecificChat}
                        myself={myself}
                        openingService={openingService}
                        setCurrentMainChat={setCurrentMainChat}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={NM.setCurrentTaskNote}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                        setMyself={setMyself}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setOpeningService={setOpeningService}
                        setTeamMembers={TEM.setTeamMembers}
                        setTeamProjects={PM.setTeamProjects}
                        socket={socket}
                        taskNoteMeta={NM.taskNoteMeta}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        teamProjects={PM.teamProjects}
                        TM={TM}
                    />
                </Box>
            </Panel>
        </>
    );

    const renderTaskNotePanel = () => (
        <>
            <PanelResizeHandle
                className="resize-handle"
                style={{
                    width: "1px",
                    backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                    transition: "all 0.3s ease-in-out",
                    cursor: "col-resize",
                }}
            />
            <Panel defaultSize={50} id={"7"} maxSize={100} minSize={50} order={7}>
                <Box
                    sx={{
                        px: { xs: 1, md: 2 },
                        pt: {
                            xs: "calc(12px + var(--Header-height))",
                            sm: "calc(12px + var(--Header-height))",
                            md: 2,
                        },
                        pb: { xs: 2, sm: 2, md: 3 },
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        height: "100dvh",
                        gap: 1,
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <TaskNoteMain
                        allChats={allChats}
                        funcSetAllChats={funcSetAllChats}
                        isInTaskPage={true}
                        myself={myself}
                        NM={NM}
                        setCurrentChat={setCurrentMainChat}
                        setCurrentMainChat={setCurrentMainChat}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setMyself={setMyself}
                        setOpeningService={setOpeningService}
                        socket={socket}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        TM={TM}
                    />
                </Box>
            </Panel>
        </>
    );

    const renderNoProjectPanel = () => (
        <>
            {renderResizeHandle()}
            <Panel id={"6"} maxSize={100} minSize={70} order={6}>
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <IconButton
                        color="neutral"
                        component="button"
                        variant="soft"
                        sx={{
                            fontSize: "15px",
                            paddingRight: "10px",
                        }}
                        onClick={() => {
                            PM.setOpenCreateProject(true);
                        }}
                    >
                        <AddIcon />
                        New Project
                    </IconButton>
                </Box>
            </Panel>
        </>
    );

    return (
        <PanelGroup autoSaveId="conditional" direction="horizontal">
            <Panel defaultSize={10} id={"1"} maxSize={30} minSize={10} order={1}>
                <Box
                    sx={{
                        height: "100%",
                        width: "100%",
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <TaskSidebar
                        isTaskHomeVisible={isTaskHomeVisible}
                        myself={myself}
                        PM={PM}
                        setCurrentFilterName={setCurrentFilterName}
                        setFilterBy={setFilterBy}
                        setIsDashboardVisible={setIsDashboardVisible}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setOpenJoinProject={() => {}}
                        setSelectedTagForFiltering={setSelectedTagForFiltering}
                        TM={TM}
                    />
                </Box>
            </Panel>

            {PM.currentProject && PM.currentProject.projectId ? (
                <>
                    {isTaskHomeVisible && (
                        <>
                            {renderResizeHandle()}
                            <Panel id={"2"} maxSize={80} minSize={30} order={2}>
                                {renderMainContent()}
                            </Panel>
                        </>
                    )}

                    {TM.isTaskPreviewVisible && TM.currentPreviewTask && renderTaskPreviewPanel()}
                    {TM.isCreatingTask.flag && renderCreateTaskPanel()}
                    {NM.isTaskNoteVisible && NM.currentTaskNoteChain && renderTaskNotePanel()}
                </>
            ) : (
                renderNoProjectPanel()
            )}
        </PanelGroup>
    );
};
