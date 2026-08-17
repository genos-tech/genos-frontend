import { useEffect, useState } from "react";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { Box, Divider, List, ListItem, ListItemContent, Sheet, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse, TagListProps } from "../../../../types/tasks";
import { loadProjectTags } from "../../services/loadProjectTags";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { ProjectsListItem } from "./ProjectsListItem";
import { RecentsListItem } from "./RecentsListItem";
import { TaskSidebarSearchBox } from "./SearchBox";
import { SprintBoardListItem } from "./SprintBoardListItem";
import { TaskTableListItem } from "./TaskTableListItem";

type TaskSidebarProps = {
    myself: UserProps;
    // Forwarded down to MilestonesListItem so its assignee avatars
    // can use AvatarWithStatus (which surfaces a UserProfile modal
    // and online-pulse dot just like the rest of the app).
    setMyself: (value: UserProps) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
};

export const TaskSidebar = (props: TaskSidebarProps) => {
    const {
        myself,
        setMyself,
        setOpenJoinProject,
        usePM,
        useTM,
        useSM,
        useTEM,
        useCM,
        useUISM,
        socket,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isMobile = useIsMobile();
    const { t } = useTranslation();

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskSearchOptions] = useState<SearchTeamTasksResponse[]>(
        []
    );
    const loading = openSearch && teamTaskSearchOptions.length === 0;
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            // Search surfaces active work only: no Closed/Deleted tasks,
            // and (via include_all=false) no tasks whose parent task /
            // milestone is already closed — the backend walks the parent
            // chain when include_all is off.
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,blocked,pending",
                -1,
                accessToken,
                false
            );

            if (active) {
                setTeamTaskSearchOptions([...loadedTeamTasks]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);
    // =======================================================================

    const [recentTasks, setRecentTasks] = useState<SearchTeamTasksResponse[]>([]);
    const updateRecentTasks = () => {
        const TOP_N = 20;
        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,pending",
                TOP_N,
                accessToken,
                true
            );
            setRecentTasks([...loadedTeamTasks.slice(0, TOP_N)]);
        })();
    };

    useEffect(() => {
        updateRecentTasks();
    }, [useTM.currentPreviewTaskId]);

    // Refresh tags whenever the active project changes, or a tag is created /
    // renamed / deleted anywhere in the app (`useTM.tagsRevision`).
    //
    // This is the only effect that FETCHES `currentProject.projectTags`, and
    // everything downstream reads it — the task filter bar's Tags dropdown, the
    // tag autocompletes, the manage-tags modal. Keyed on the projectId alone it
    // never re-ran after a mutation (creating a tag doesn't change the project),
    // so a new tag was invisible in the filter until a page reload. Adding the
    // revision reuses the fetch + race guard that already live here instead of
    // giving each tag modal its own copy of them.
    //
    // This used to fire on `[myself]`, which produced a tricky team-switch
    // race: on team change `myself` flips first, so this effect fired while
    // `usePM.currentProject` was still the PREVIOUS team's project. It would
    // request tags for that stale projectId and then call
    //   setCurrentProject({ ...oldProj_A, projectTags: ... })
    // — clobbering the new team's auto-picked project (chosen by
    // useProjectManagement.loadProjectsAndTasks) with the old team's project.
    // The visible symptom was: after switching teams the project id never
    // changed, even when the new team had multiple joined projects.
    //
    // Tying the effect to `currentProject?.projectId` means it only loads
    // tags for the project that is actually selected, and the cancelled
    // flag drops any in-flight response if the user (or the team-switch
    // reset) moves to a different project before our await resolves.
    useEffect(() => {
        const projectAtStart = usePM.currentProject;
        if (!projectAtStart || !projectAtStart.projectId) return;
        const targetProjectId = projectAtStart.projectId;

        let cancelled = false;
        (async () => {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                targetProjectId,
                accessToken
            );
            if (cancelled) return;
            // `loadProjectTags` resolves to undefined when the request fails.
            // Writing that through would blank the tag list everywhere on a
            // single flaky response — far more likely now that this runs on
            // every tag mutation, not just once per project. An empty ARRAY is
            // a legitimate result (the last tag was deleted) and must land.
            if (!Array.isArray(loadedProjectTags)) return;
            usePM.setCurrentProject({
                ...projectAtStart,
                projectTags: loadedProjectTags,
            });
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usePM.currentProject?.projectId, useTM.tagsRevision]);

    return (
        <Sheet
            className="TaskSidebar"
            sx={{
                // On mobile (MobileTaskHome) we render the sidebar inline,
                // not as a slide-in overlay, so the translate transform
                // and fixed positioning are desktop-only.
                position: { xs: "relative", md: "sticky" },
                transform: {
                    xs: "none",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                // Mobile: fill the MobileTaskHome container (already
                // clamped to viewport - tab bar). Desktop: viewport
                // height since the sticky Sheet has no explicit parent
                // height.
                height: { xs: "100%", md: "100dvh" },
                width: "100%",
                top: 0,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
            {/* Search Box */}
            <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
                <TaskSidebarSearchBox
                    loading={loading}
                    openSearch={openSearch}
                    setOpenSearch={setOpenSearch}
                    setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                    teamTaskSearchOptions={teamTaskSearchOptions}
                    useTM={useTM}
                />
            </Box>

            {/* Content */}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    px: 1.5,
                    py: 0.5,
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.5,
                        "--List-nestedInsetStart": "24px",
                        "--ListItem-radius": "8px",
                    }}
                >
                    {/* Home Item */}
                    <ListItem>
                        <ListItemButton
                            selected={useTM.isTaskDashboardVisible}
                            sx={{
                                borderRadius: "10px",
                                py: 1,
                                px: 1.5,
                                gap: 1.5,
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                "&:hover": {
                                    backgroundColor: isDark
                                        ? "rgba(var(--gp-brand-700-rgb), 0.06)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.04)",
                                },
                                "&.Mui-selected": {
                                    backgroundColor: isDark
                                        ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.1)",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(var(--gp-brand-700-rgb), 0.2)"
                                            : "rgba(var(--gp-brand-700-rgb), 0.15)",
                                    },
                                },
                            }}
                            onClick={() => {
                                useTM.setIsTaskDashboardVisible(true);
                                useTM.setIsTaskTableVisible(false);
                                useTM.setIsSprintBoardVisible(false);
                            }}
                        >
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isDark
                                        ? "rgba(var(--gp-brand-700-rgb), 0.08)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.05)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <HomeRoundedIcon
                                    sx={{
                                        fontSize: 16,
                                        color: isDark
                                            ? "rgba(255,255,255,0.75)"
                                            : "rgba(0,0,0,0.65)",
                                    }}
                                />
                            </Box>
                            <ListItemContent>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.8)",
                                    }}
                                >
                                    {t.tasks.sidebar.home}
                                </Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    {/* Section Header - Views — Table and Sprint Board
                        aren't reachable on mobile (MobileTaskHome only
                        renders the dashboard or MobileTaskList), so the
                        whole Views section is dropped on xs. The flags
                        (`isTaskTableVisible` / `isSprintBoardVisible`)
                        still drive the desktop layout when the user
                        resizes back to ≥md. */}
                    {!isMobile && (
                        <>
                            <Box sx={{ pt: 1.5, pb: 0.5, px: 1 }}>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.08em",
                                        fontSize: 10,
                                        color: isDark
                                            ? "rgba(255,255,255,0.4)"
                                            : "rgba(0,0,0,0.4)",
                                    }}
                                >
                                    {t.tasks.sidebar.viewsHeader}
                                </Typography>
                            </Box>
                            <TaskTableListItem useTM={useTM} />
                            <SprintBoardListItem useTM={useTM} />
                        </>
                    )}

                    {/* Section Header - Tasks */}
                    <Box sx={{ pt: 1.5, pb: 0.5, px: 1 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                fontSize: 10,
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            }}
                        >
                            {t.tasks.sidebar.tasksHeader}
                        </Typography>
                    </Box>

                    <RecentsListItem recentTasks={recentTasks} usePM={usePM} useTM={useTM} />

                    {/* Section Header - Projects */}
                    <Box sx={{ pt: 1.5, pb: 0.5, px: 1 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                fontSize: 10,
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            }}
                        >
                            {t.tasks.sidebar.projectsHeader}
                        </Typography>
                    </Box>

                    <ProjectsListItem
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
                </List>
            </Box>

            {/* Footer */}
            <Divider sx={{ opacity: isDark ? 0.08 : 0.12 }} />
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                        fontSize: 10,
                    }}
                >
                    {t.tasks.sidebar.footerTagline}
                </Typography>
            </Box>
        </Sheet>
    );
};
