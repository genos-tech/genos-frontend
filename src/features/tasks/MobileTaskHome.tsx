import AddIcon from "@mui/icons-material/Add";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { CreateTaskForm } from "./components/contents/CreateTaskForm";
import { TaskPreview } from "./components/contents/TaskPreview";
import { TaskDashboard } from "./components/dashboard/TaskDashboard";
import { TaskSidebar } from "./components/sidebar/TaskSidebarMain";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatNoteMain } from "../notes/chat-notes/components/ChatNoteMain";
import { MyNoteMain } from "../notes/my-notes/components/MyNoteMain";
import { TaskNoteMain } from "../notes/task-notes/components/TaskNoteMain";
import { MobileTaskList } from "./MobileTaskList";

type MobileTaskHomeProps = {
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;
    useSM: SprintMilestoneManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    // Only the ACTIVE keep-alive Home may mount CreateTaskForm — each
    // mount POSTs its own empty task and writes the shared
    // `useTM.initialEmptyTaskId`, so a hidden second instance races the
    // visible one and the loser hangs on "Preparing task…".
    isActiveRoute: boolean;
    onCloseTaskHome: () => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
};

// Full-screen overlay shell. Mirrors MobileOverlay in MobileChatHome.
const MobileOverlay = ({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose: () => void;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1300,
                background: isDark
                    ? "linear-gradient(180deg, rgba(20,14,34,1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--BottomTabBar-height, 60px)",
            }}
        >
            <IconButton
                aria-label="Close"
                size="sm"
                variant="plain"
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    borderRadius: "10px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                    },
                }}
                onClick={onClose}
            >
                <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pt: 5 }}>{children}</Box>
        </Box>
    );
};

export const MobileTaskHome = (props: MobileTaskHomeProps) => {
    const {
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
        onCloseTaskHome,
        setOpenJoinProject,
    } = props;

    const location = useLocation();
    const navigate = useNavigate();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Pane selection: URL-driven for project, flag-driven for the
    // sub-views (dashboard vs task list). useTaskRouting reconciles URL
    // segments with flags so we can read both.
    const pathHasProject = location.pathname.includes("/project/");
    const hasProject = pathHasProject && !!usePM.currentProject?.projectId;

    // Dashboard is its own "Home" view on mobile — reachable from the
    // sidebar's Home button even when no project is selected. The
    // TaskDashboard internals tolerate an undefined project (sprint
    // dialogs are gated on currentProject inside the component).
    const showDashboard = useTM.isTaskDashboardVisible === true;
    const showList = !showDashboard && hasProject;
    const showSidebar = !showDashboard && !showList;

    const handleCloseTaskPreview = () => {
        // Mirror TaskHomeLayout's behavior: clear preview state so the URL
        // sync effect scrubs the /task/:id segment.
        useTM.setIsTaskPreviewVisible(false);
        useTM.setCurrentPreviewTaskId(-1);
    };

    const handleBackToProjects = () => {
        // Clear the current project so useTaskRouting doesn't re-sync
        // the URL back to /project/:id immediately after we navigate.
        usePM.setCurrentProject(null);
        navigate("/workspace/tasks");
    };

    // Dashboard back: turn the Home view off. If there's still a
    // project in the URL, MobileTaskHome will fall back to the task
    // list for it; otherwise it returns to the project picker.
    const handleBackFromDashboard = () => {
        useTM.setIsTaskDashboardVisible(false);
        if (!hasProject) {
            usePM.setCurrentProject(null);
            navigate("/workspace/tasks");
        }
    };

    const handleCreateTaskClick = () => {
        useTM.handleCreateTask();
    };

    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    return (
        <Box
            sx={{
                flex: 1,
                height: "100%",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Compact mobile header — renders for the dashboard view
                AND for the project task list. The bare sidebar (no
                project, no dashboard) has its own search/header inside
                TaskSidebar so we don't add a second one above it. */}
            {(hasProject || showDashboard) && (
                <Stack
                    direction="row"
                    sx={{
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.75,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        background: isDark ? "rgba(20,14,34,0.85)" : "rgba(252,250,255,0.85)",
                        backdropFilter: "blur(8px)",
                        minHeight: "56px",
                        flexShrink: 0,
                    }}
                >
                    <IconButton
                        aria-label="Back"
                        size="sm"
                        sx={{ flexShrink: 0 }}
                        variant="plain"
                        onClick={showDashboard ? handleBackFromDashboard : handleBackToProjects}
                    >
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography
                        level="title-sm"
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: 700,
                        }}
                        noWrap
                    >
                        {showDashboard && !hasProject
                            ? "Home"
                            : (usePM.currentProject?.projectName ?? "Tasks")}
                    </Typography>

                    {/* View toggle + Create — only meaningful when a
                        specific project is open. In dashboard-only Home
                        view (no project) these collapse to nothing. */}
                    {hasProject && (
                        <>
                            <IconButton
                                aria-label="List view"
                                color={showList ? "primary" : "neutral"}
                                size="sm"
                                variant={showList ? "soft" : "plain"}
                                sx={{
                                    color: showList ? (isDark ? "#a78bfa" : "#7c3aed") : undefined,
                                }}
                                onClick={() => useTM.setIsTaskDashboardVisible(false)}
                            >
                                <ListAltRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton
                                aria-label="Dashboard"
                                color={showDashboard ? "primary" : "neutral"}
                                size="sm"
                                variant={showDashboard ? "soft" : "plain"}
                                sx={{
                                    color: showDashboard
                                        ? isDark
                                            ? "#a78bfa"
                                            : "#7c3aed"
                                        : undefined,
                                }}
                                onClick={() => useTM.setIsTaskDashboardVisible(true)}
                            >
                                <DashboardRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>

                            <IconButton
                                aria-label="Create task"
                                color="primary"
                                size="sm"
                                sx={{ flexShrink: 0 }}
                                variant="solid"
                                onClick={handleCreateTaskClick}
                            >
                                <AddIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </>
                    )}

                    <Dropdown>
                        <MenuButton
                            slotProps={{ root: { size: "sm", variant: "plain" } }}
                            slots={{ root: IconButton }}
                        >
                            <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                        </MenuButton>
                        <Menu placement="bottom-end" size="sm" sx={{ minWidth: 180 }}>
                            <MenuItem
                                onClick={async () => {
                                    if (usePM.currentProject?.projectId) {
                                        await usePM.refreshProjectTasks(
                                            usePM.currentProject.projectId
                                        );
                                    }
                                }}
                            >
                                Refresh tasks
                            </MenuItem>
                            <MenuItem onClick={() => usePM.setOpenCreateProject(true)}>
                                New project
                            </MenuItem>
                            <MenuItem onClick={() => useTM.setOpenCreateTag(true)}>
                                New tag
                            </MenuItem>
                        </Menu>
                    </Dropdown>
                </Stack>
            )}

            {/* Content area below the header. flex: 1 so the panes fill
                remaining space above the bottom tab bar. */}
            <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                {showSidebar && (
                    <Box sx={{ height: "100%", width: "100%" }}>
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
                )}

                {showDashboard && (
                    <Box sx={{ height: "100%", width: "100%", overflow: "auto" }}>
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
                    </Box>
                )}

                {showList && (
                    <Box
                        sx={{
                            height: "100%",
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <MobileTaskList usePM={usePM} useTM={useTM} />
                    </Box>
                )}
            </Box>

            {/* Flag-driven full-screen overlays */}
            {useTM.isTaskPreviewVisible &&
                (useTM.currentPreviewTask ||
                    useTM.currentPreviewTaskId !== -1 ||
                    useTM.currentPreviewKind === "milestone") && (
                    <MobileOverlay onClose={handleCloseTaskPreview}>
                        <Box sx={{ p: 1, height: "100%", overflow: "auto" }}>
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
                    </MobileOverlay>
                )}

            {useTM.isCreatingTask.flag === true && isActiveRoute && (
                <MobileOverlay
                    onClose={() => useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }))}
                >
                    <Box sx={{ p: 1, height: "100%", overflow: "auto" }}>
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
                </MobileOverlay>
            )}

            {useNM.isTaskNoteVisible && useNM.currentTaskNoteChain && (
                <MobileOverlay onClose={() => useNM.setIsTaskNoteVisible(false)}>
                    <Box sx={{ p: 1, height: "100%", overflow: "auto" }}>
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
                </MobileOverlay>
            )}
        </Box>
    );
};
