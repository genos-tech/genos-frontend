import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import { Box, Dropdown, IconButton, MenuButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { CreateTaskForm } from "./components/contents/CreateTaskForm";
import { TaskPreview } from "./components/contents/TaskPreview";
import { TaskDashboard } from "./components/dashboard/TaskDashboard";
import { TaskSearchBar } from "./components/header/TaskSearchBar";
import { ModalCustomizeTaskFields } from "./components/modals/ModalCustomizeTaskFields";
import { ModalImportTasksCsv } from "./components/modals/ModalImportTasksCsv";
import { TaskSidebar } from "./components/sidebar/TaskSidebarMain";

import { MobileOverlay } from "../../components/layout/MobileOverlay";
import { MenuRow, MenuSurface } from "../../components/ui/MoreMenu";
import { headerTouchTargetsSx } from "../../components/ui/touchTargets";
import { useAuth } from "../../context/authState";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { useSoloCreatePane } from "../../hooks/tasks/useSoloCreatePane";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { emitRequestError } from "../../services/requestErrorNotifier";
import { UserProps } from "../../types/admin";
import { archiveProject, unarchiveProject } from "../archive/archiveApi";
import { ArchivedBanner } from "../archive/ArchivedBanner";
import { useArchiveState, useIsProjectArchived } from "../archive/archiveState";
import { useCreateTaskBlockedByArchive } from "../archive/createTaskGuard";
import { canCustomizeTaskFields, isOwnerOfProject } from "../archive/projectOwner";
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
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // CSV task import (MIP-1835): not offered on an archived project.
    const [openImportCsv, setOpenImportCsv] = useState(false);
    const [openCustomizeFields, setOpenCustomizeFields] = useState(false);
    const archiveState = useArchiveState();
    const importProjectId = usePM.currentProject?.projectId;
    const importArchived = archiveState.archivedProjects.some(
        (p) => p.projectId === importProjectId
    );

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

    // Owner and editors, the same gate as the desktop header (MIP-2336, MIP-2531).
    const canCustomizeFields =
        hasProject &&
        canCustomizeTaskFields(
            useTM.taskFieldRules,
            usePM.currentProject?.projectId,
            myself.userId
        );

    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    // Archive (MIP-1693, MIP-1854): the same rules as the desktop header. An archived project is
    // read-only here: the list and the task preview stay readable (tap, scroll), Create is hidden, and the banner says why. Only
    // the owner may archive or restore, and the menu offers it to the owner alone.
    const { accessToken } = useAuth();
    const openProjectId = usePM.currentProject?.projectId;
    const archived = useIsProjectArchived(openProjectId);
    // MIP-2370: a form opened with no preview on screen shares the preview overlay, so
    // submitting swaps its content to the new item instead of closing one overlay and
    // opening another.
    const previewOverlayShown =
        useTM.isTaskPreviewVisible &&
        !!(
            useTM.currentPreviewTask ||
            useTM.currentPreviewTaskId !== -1 ||
            useTM.currentPreviewKind === "milestone"
        );
    const createOverlayShown = useTM.isCreatingTask.flag === true && isActiveRoute && !archived;
    const soloCreate = useSoloCreatePane(createOverlayShown, previewOverlayShown);
    const createForm = (
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
    );
    // A create intent left set when the project is archived is dropped, or the form would open by itself on unarchive.
    useCreateTaskBlockedByArchive(
        openProjectId,
        useTM.isCreatingTask.flag === true,
        useTM.setIsCreatingTask
    );
    const archivedRecord = useArchiveState().archivedProjects.find(
        (p) => p.projectId === openProjectId
    );
    const isProjectOwner = isOwnerOfProject(useTM.taskFieldRules, openProjectId, myself.userId);
    const [archiveBusy, setArchiveBusy] = useState(false);

    // Archive the open project, or put an archived one back. The list moves at once; a refusal
    // says so in one line, and the project stays as it was.
    const toggleArchive = async () => {
        const current = usePM.currentProject;
        if (!current || archiveBusy) return;
        setArchiveBusy(true);
        try {
            if (archived) {
                await unarchiveProject(accessToken, myself.teamId, archivedRecord ?? current);
                usePM.setTeamProjects([...usePM.teamProjects, archivedRecord ?? current]);
            } else {
                await archiveProject(accessToken, myself.teamId, current);
                usePM.setTeamProjects(
                    usePM.teamProjects.filter((p) => p.projectId !== current.projectId)
                );
            }
        } catch {
            emitRequestError(
                "serverMessage",
                archived ? t.common.archive.unarchiveFailed : t.common.archive.archiveFailed
            );
        } finally {
            setArchiveBusy(false);
        }
    };

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
                        // 4px, not 6: a 44px button plus 2 x 6px would push the 56px bar to 57.
                        py: 0.5,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        background: isDark
                            ? "rgba(var(--gp-dark-surface-b-rgb), 0.85)"
                            : "rgba(252,250,255,0.85)",
                        backdropFilter: "blur(8px)",
                        minHeight: "56px",
                        flexShrink: 0,
                        // Back, list, dashboard, create, more: 44px targets on a phone.
                        ...headerTouchTargetsSx,
                    }}
                >
                    <IconButton
                        aria-label={t.tasks.mobile.back}
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
                            ? t.tasks.mobile.home
                            : (usePM.currentProject?.projectName ?? t.tasks.mobile.tasks)}
                    </Typography>

                    {/* View toggle + Create — only meaningful when a
                        specific project is open. In dashboard-only Home
                        view (no project) these collapse to nothing. */}
                    {hasProject && (
                        <>
                            <IconButton
                                aria-label={t.tasks.mobile.listView}
                                color={showList ? "primary" : "neutral"}
                                size="sm"
                                variant={showList ? "soft" : "plain"}
                                sx={{
                                    color: showList
                                        ? isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)"
                                        : undefined,
                                }}
                                onClick={() => useTM.setIsTaskDashboardVisible(false)}
                            >
                                <ListAltRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton
                                aria-label={t.tasks.mobile.dashboard}
                                color={showDashboard ? "primary" : "neutral"}
                                size="sm"
                                variant={showDashboard ? "soft" : "plain"}
                                sx={{
                                    color: showDashboard
                                        ? isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-700)"
                                        : undefined,
                                }}
                                onClick={() => useTM.setIsTaskDashboardVisible(true)}
                            >
                                <DashboardRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>

                            {!archived && (
                                <IconButton
                                    aria-label={t.tasks.mobile.createTask}
                                    color="primary"
                                    size="sm"
                                    sx={{ flexShrink: 0 }}
                                    variant="solid"
                                    onClick={handleCreateTaskClick}
                                >
                                    <AddIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            )}
                        </>
                    )}

                    <Dropdown>
                        <MenuButton
                            aria-label={t.common.ui.moreMenu.ariaLabel}
                            slotProps={{ root: { size: "sm", variant: "plain" } }}
                            slots={{ root: IconButton }}
                        >
                            <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                        </MenuButton>
                        <MenuSurface placement="bottom-end">
                            <MenuRow
                                onClick={async () => {
                                    if (usePM.currentProject?.projectId) {
                                        await usePM.refreshProjectTasks(
                                            usePM.currentProject.projectId
                                        );
                                    }
                                }}
                            >
                                {t.tasks.mobile.refreshTasks}
                            </MenuRow>
                            <MenuRow onClick={() => useTM.setOpenManageTags(true)}>
                                {t.tasks.mobile.manageTags}
                            </MenuRow>
                            {canCustomizeFields && (
                                <MenuRow onClick={() => setOpenCustomizeFields(true)}>
                                    {t.tasks.header.customizeFieldsMenuItem}
                                </MenuRow>
                            )}
                            {importProjectId != null && !importArchived && (
                                <MenuRow onClick={() => setOpenImportCsv(true)}>
                                    {t.tasks.importCsv.menuItem}
                                </MenuRow>
                            )}
                            <MenuRow onClick={() => usePM.setOpenCreateProject(true)}>
                                {t.tasks.mobile.newProject}
                            </MenuRow>
                            {hasProject && isProjectOwner && (
                                <MenuRow
                                    mark="none"
                                    icon={
                                        archived ? (
                                            <UnarchiveOutlinedIcon sx={{ fontSize: 18 }} />
                                        ) : (
                                            <ArchiveOutlinedIcon sx={{ fontSize: 18 }} />
                                        )
                                    }
                                    onClick={toggleArchive}
                                >
                                    {archived
                                        ? t.common.archive.unarchiveMenuProject
                                        : t.common.archive.archiveMenuProject}
                                </MenuRow>
                            )}
                        </MenuSurface>
                    </Dropdown>
                </Stack>
            )}

            {/* The one task search (MIP-1990), under the header on a phone. */}
            {(showList || showSidebar) && (
                <Box sx={{ px: 1, py: 0.75, flexShrink: 0 }}>
                    <TaskSearchBar
                        accessToken={accessToken}
                        myself={myself}
                        projectId={usePM.currentProject?.projectId}
                        openTask={(taskId) => {
                            useTM.setCurrentPreviewTaskId(taskId);
                            useTM.setIsTaskPreviewVisible(true);
                        }}
                    />
                </Box>
            )}

            {showList && archived && (
                <ArchivedBanner
                    busy={archiveBusy}
                    kind="project"
                    onRestore={isProjectOwner ? toggleArchive : undefined}
                />
            )}

            {/* Content area below the header. flex: 1 so the panes fill
                remaining space above the bottom tab bar. */}
            <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                {showSidebar && (
                    <Box sx={{ height: "100%", width: "100%" }}>
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
                )}

                {showDashboard && (
                    <Box sx={{ height: "100%", width: "100%", overflow: "auto" }}>
                        <TaskDashboard
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
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <MobileTaskList usePM={usePM} useTM={useTM} />
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Flag-driven full-screen overlays */}
            {(soloCreate || previewOverlayShown) && (
                <MobileOverlay
                    onClose={
                        soloCreate
                            ? () => useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }))
                            : handleCloseTaskPreview
                    }
                >
                    {soloCreate ? (
                        <Box sx={{ p: 1, flex: 1, minHeight: 0, overflow: "auto" }}>
                            {createForm}
                        </Box>
                    ) : (
                        <>
                            {/* No wrapper: `TaskPreviewLayout`'s Sheet already
                            owns `overflowY: auto` and now flexes to fill
                            below `md`, so it becomes the ONE scroller and
                            uses the whole overlay. The old
                            `p: 1 / height: 100% / overflow: auto` box was a
                            second scroller around a Sheet pinned to
                            `minHeight: 500` — a short card in a tall empty
                            overlay, which is the wasted space in the
                            report. */}
                            <Box
                                sx={{
                                    flex: 1,
                                    minHeight: 0,
                                    display: "flex",
                                    flexDirection: "column",
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
                                    holdSwitchWithLoader
                                />
                            </Box>
                        </>
                    )}
                </MobileOverlay>
            )}

            {createOverlayShown && !soloCreate && (
                <MobileOverlay
                    onClose={() => useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }))}
                >
                    <Box sx={{ p: 1, flex: 1, minHeight: 0, overflow: "auto" }}>{createForm}</Box>
                </MobileOverlay>
            )}

            {/* Derived, not the raw intent flag — an overlay with every
                note tab closed has nothing to render inside it. */}
            {useNM.isTaskNotePaneVisible && useNM.currentTaskNoteChain && (
                <MobileOverlay onClose={() => useNM.setIsTaskNoteVisible(false)}>
                    <Box sx={{ p: 1, flex: 1, minHeight: 0, overflow: "auto" }}>
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
                            // Read-only like the desktop note panel (MIP-1693): the server has no archive check on notes.
                            <Box inert={archived}>
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
            {importProjectId != null && openImportCsv && (
                <ModalImportTasksCsv
                    projectId={importProjectId}
                    open
                    onChanged={() => void usePM.refreshProjectTasks(importProjectId)}
                    onClose={() => setOpenImportCsv(false)}
                />
            )}
            {openCustomizeFields && (
                <ModalCustomizeTaskFields
                    myself={myself}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    open
                    onClose={() => setOpenCustomizeFields(false)}
                />
            )}
        </Box>
    );
};
