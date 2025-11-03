import AddIcon from "@mui/icons-material/Add";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskNoteMain } from "../../../notes/task-notes/components/TaskNoteMain";
import { CreateTaskForm } from "../contents/CreateTaskForm";
import { TaskPreview } from "../contents/TaskPreview";
import { TaskDashboard } from "../dashboard/TaskDashboard";
import { TaskHomeHeader } from "../header/TaskHomeHeader";
import { TaskSidebar } from "../sidebar/TaskSidebarMain";
import { ProjectTaskTable } from "../table/TaskTable";

interface TaskHomeLayoutProps {
    // Management states
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
    NM: NoteManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
    socket: Socket | null;

    // Header props
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
}

export const TaskHomeLayout = ({
    TEM,
    PM,
    TM,
    NM,
    myself,
    setMyself,
    CM,
    UIM,
    socket,
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
            {TM.isDashboardVisible && <TaskDashboard />}
            {TM.isTaskHomeVisible && (
                <>
                    <TaskHomeHeader
                        CM={CM}
                        currentProject={PM.currentProject}
                        myself={myself}
                        setMyself={setMyself}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onCreateTag={onCreateTag}
                        onDeleteProject={onDeleteProject}
                    />
                    <ProjectTaskTable
                        currentProject={PM.currentProject}
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
                        CM={CM}
                        myself={myself}
                        PM={PM}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
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
                        CM={CM}
                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                        isTaskNoteVisible={NM.isTaskNoteVisible}
                        myself={myself}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={NM.setCurrentTaskNote}
                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                        setMyself={setMyself}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setTeamProjects={PM.setTeamProjects}
                        socket={socket}
                        taskNoteMeta={NM.taskNoteMeta}
                        teamProjects={PM.teamProjects}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
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
                        CM={CM}
                        isInTaskPage={true}
                        myself={myself}
                        NM={NM}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
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
                    <TaskSidebar myself={myself} PM={PM} setOpenJoinProject={() => {}} TM={TM} />
                </Box>
            </Panel>

            {PM.currentProject && PM.currentProject.projectId ? (
                <>
                    {TM.isTaskHomeVisible && (
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
