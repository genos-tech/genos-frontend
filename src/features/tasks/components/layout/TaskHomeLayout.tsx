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
import { SprintBoard } from "../board";
import { CreateTaskForm } from "../contents/CreateTaskForm";
import { TaskPreview } from "../contents/TaskPreview";
import { TaskDashboard } from "../dashboard/TaskDashboard";
import { TaskHomeHeader } from "../header/TaskHomeHeader";
import { TaskSidebar } from "../sidebar/TaskSidebarMain";
import { DraggableTaskTable } from "../table/DraggableTaskTable";

interface TaskHomeLayoutProps {
    // Management states
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;

    // Props
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;

    // Header props
    onCreateProject: () => void;
    onCreateTag: () => void;
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
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    onCreateProject,
    onCreateTag,
    onDeleteProject,
    onCloseTaskHome,
    setOpenJoinProject,
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
                borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
            }}
        >
            {useTM.isDashboardVisible && (
                <TaskDashboard
                    useTM={useTM}
                    usePM={usePM}
                    useTEM={useTEM}
                    myself={myself}
                    setMyself={setMyself}
                    useCM={useCM}
                    useUISM={useUISM}
                    socket={socket}
                />
            )}
            {useTM.isTaskHomeVisible && (
                <>
                    <TaskHomeHeader
                        useCM={useCM}
                        usePM={usePM}
                        myself={myself}
                        setMyself={setMyself}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onCreateTag={onCreateTag}
                        onDeleteProject={onDeleteProject}
                    />
                    <DraggableTaskTable
                        usePM={usePM}
                        myself={myself}
                        setTeamMembers={useTEM.setTeamMembers}
                        teamMembers={useTEM.teamMembers}
                        useTM={useTM}
                        socket={socket}
                        useTEM={useTEM}
                        useCM={useCM}
                        useUISM={useUISM}
                        setMyself={setMyself}
                    />
                </>
            )}
            {useTM.isSprintBoardVisible && (
                <>
                    <TaskHomeHeader
                        useCM={useCM}
                        usePM={usePM}
                        myself={myself}
                        setMyself={setMyself}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onCreateTag={onCreateTag}
                        onDeleteProject={onDeleteProject}
                    />
                    <SprintBoard
                        usePM={usePM}
                        myself={myself}
                        setTeamMembers={useTEM.setTeamMembers}
                        teamMemberProfiles={useTEM.teamMemberProfiles}
                        teamMembers={useTEM.teamMembers}
                        useTM={useTM}
                        socket={socket}
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
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                    }}
                >
                    <CreateTaskForm
                        chatType={-1}
                        useCM={useCM}
                        myself={myself}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        useNM={useNM}
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
                        useCM={useCM}
                        useNM={useNM}
                        myself={myself}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
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
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                    }}
                >
                    <TaskNoteMain
                        useCM={useCM}
                        isInTaskPage={true}
                        myself={myself}
                        useNM={useNM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
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
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
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
                            usePM.setOpenCreateProject(true);
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
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                    }}
                >
                    <TaskSidebar
                        myself={myself}
                        usePM={usePM}
                        setOpenJoinProject={setOpenJoinProject}
                        useTM={useTM}
                    />
                </Box>
            </Panel>

            {usePM.currentProject && usePM.currentProject.projectId ? (
                <>
                    {(useTM.isTaskHomeVisible ||
                        useTM.isSprintBoardVisible ||
                        useTM.isDashboardVisible) && (
                        <>
                            {renderResizeHandle()}
                            <Panel id={"2"} maxSize={80} minSize={30} order={2}>
                                {renderMainContent()}
                            </Panel>
                        </>
                    )}

                    {useTM.isTaskPreviewVisible &&
                        useTM.currentPreviewTask &&
                        renderTaskPreviewPanel()}
                    {useTM.isCreatingTask.flag && renderCreateTaskPanel()}
                    {useNM.isTaskNoteVisible &&
                        useNM.currentTaskNoteChain &&
                        renderTaskNotePanel()}
                </>
            ) : (
                renderNoProjectPanel()
            )}
        </PanelGroup>
    );
};
