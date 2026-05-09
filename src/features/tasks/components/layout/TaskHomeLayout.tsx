import AddRoundedIcon from "@mui/icons-material/AddRounded";
import WorkspacesRoundedIcon from "@mui/icons-material/WorkspacesRounded";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
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
    useSM,
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
                />
            )}
            {(useTM.isTaskTableVisible || useTM.isSprintBoardVisible) && (
                <>
                    <TaskHeader
                        myself={myself}
                        setMyself={setMyself}
                        useCM={useCM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCloseTaskHome={onCloseTaskHome}
                        onCreateProject={onCreateProject}
                        onCreateTag={onCreateTag}
                        onDeleteProject={onDeleteProject}
                    />
                    {useTM.isTaskTableVisible && (
                        <>
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
                        </>
                    )}
                    {useTM.isSprintBoardVisible && (
                        <>
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
                        </>
                    )}
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
                </Box>
            </Panel>
        </>
    );

    const renderNoProjectPanel = () => {
        const isDark = mode === "dark";
        // Sidebar nav items use this purple palette (#a78bfa dark / #7c3aed
        // light); reuse it so the empty state feels native to the Tasks
        // service.
        const accent = isDark ? "#a78bfa" : "#7c3aed";

        return (
            <>
                {renderResizeHandle()}
                <Panel id={"6"} maxSize={100} minSize={70} order={6}>
                    <Box
                        sx={{
                            height: "100%",
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            p: 4,
                            borderRight: isDark ? "1px black inset" : "1px lightgrey inset",
                            background: isDark
                                ? `radial-gradient(1200px 600px at 50% 0%, ${accent}10 0%, transparent 60%)`
                                : `radial-gradient(1200px 600px at 50% 0%, ${accent}0d 0%, transparent 60%)`,
                        }}
                    >
                        <Stack
                            alignItems="center"
                            spacing={2.5}
                            sx={{
                                width: "100%",
                                maxWidth: 460,
                                textAlign: "center",
                                p: { xs: 3, sm: 5 },
                                borderRadius: "xl",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.06)",
                                background: isDark
                                    ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)",
                                backdropFilter: "blur(8px)",
                                boxShadow: isDark
                                    ? "0 12px 40px rgba(0,0,0,0.35)"
                                    : "0 12px 40px rgba(124,58,237,0.08)",
                            }}
                        >
                            <Box
                                sx={{
                                    position: "relative",
                                    width: 72,
                                    height: 72,
                                    borderRadius: "20px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? `linear-gradient(135deg, ${accent}30 0%, ${accent}15 100%)`
                                        : `linear-gradient(135deg, ${accent}20 0%, ${accent}10 100%)`,
                                    border: "1px solid",
                                    borderColor: isDark ? `${accent}40` : `${accent}30`,
                                    boxShadow: isDark
                                        ? `0 8px 24px ${accent}25`
                                        : `0 8px 24px ${accent}1f`,
                                }}
                            >
                                <WorkspacesRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: accent,
                                    }}
                                />
                            </Box>

                            <Stack alignItems="center" spacing={0.75}>
                                <Typography level="h4" sx={{ fontWeight: 700 }}>
                                    No project selected
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.65)"
                                            : "rgba(0,0,0,0.6)",
                                        maxWidth: 360,
                                    }}
                                >
                                    Pick a project from the sidebar to see its tasks, or spin up a
                                    new one to get your team organized.
                                </Typography>
                            </Stack>

                            <Button
                                size="lg"
                                startDecorator={<AddRoundedIcon />}
                                sx={{
                                    mt: 0.5,
                                    px: 2.5,
                                    py: 1.1,
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                                    boxShadow: `0 8px 20px ${accent}45`,
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`,
                                        transform: "translateY(-1px)",
                                        boxShadow: `0 12px 28px ${accent}55`,
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                    },
                                }}
                                onClick={() => usePM.setOpenCreateProject(true)}
                            >
                                Create new project
                            </Button>
                        </Stack>
                    </Box>
                </Panel>
            </>
        );
    };

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
                        setMyself={setMyself}
                        setOpenJoinProject={setOpenJoinProject}
                        socket={socket}
                        useCM={useCM}
                        usePM={usePM}
                        useSM={useSM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            </Panel>

            {usePM.currentProject && usePM.currentProject.projectId ? (
                <>
                    {(useTM.isTaskTableVisible ||
                        useTM.isSprintBoardVisible ||
                        useTM.isTaskDashboardVisible) && (
                        <>
                            {renderResizeHandle()}
                            <Panel id={"2"} maxSize={85} minSize={30} order={2}>
                                {renderMainContent()}
                            </Panel>
                        </>
                    )}

                    {useTM.isTaskPreviewVisible &&
                        (useTM.currentPreviewTask || useTM.currentPreviewKind === "milestone") &&
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
