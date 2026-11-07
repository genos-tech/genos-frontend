import { memo, useEffect, useState } from "react";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { Box, Divider, List, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse, TagListProps } from "../../../../types/tasks";
import { useOnTaskMetadataSaved } from "../../hooks/useOnTaskMetadataSaved";
import { useOnTaskOpened } from "../../hooks/useOnTaskOpened";
import { loadProjectTags } from "../../services/loadProjectTags";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { loadRecentTasks } from "../../services/recentTasks";
import { FavoritesListItem } from "./FavoritesListItem";
import { ProjectsListItem } from "./ProjectsListItem";
import { RecentsListItem } from "./RecentsListItem";
import { TaskSidebarSearchBox } from "./SearchBox";
import { SprintBoardListItem } from "./SprintBoardListItem";
import { TaskTableListItem } from "./TaskTableListItem";
import { SidebarSlices, useSidebarSlices } from "./useSidebarSlices";

// A batch of status changes (several table edits, a run of drags) reloads
// Recents once.
const RECENTS_RELOAD_DEBOUNCE_MS = 500;

type SetOpenJoinProject = (value: {
    flag: boolean;
    projectId: number;
    projectName: string;
    isPrivate: boolean;
    systemUserId: string;
}) => void;

type TaskSidebarProps = {
    myself: UserProps;
    setOpenJoinProject: SetOpenJoinProject;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
};

/**
 * The task sidebar, as the two task pages (desktop and mobile) mount it: with
 * the whole managers. It cuts them into the slices each part of the sidebar
 * reads and hands only those to the memoized body, so an `AppBody` render that
 * changed none of those values renders nothing below this line (MIP-971).
 * `AppBody` renders about a dozen times per task click, and every manager is a
 * new object on every one of those renders.
 *
 * `setMyself`, `socket` and `useUISM` are not props any more: nothing under the
 * sidebar read them. The assignee avatars it renders take them from the avatar
 * context.
 */
export const TaskSidebar = (props: TaskSidebarProps) => {
    const { myself, setOpenJoinProject, usePM, useTM, useSM, useTEM, useCM } = props;
    const slices = useSidebarSlices({ usePM, useTM, useSM, useTEM, useCM });
    return (
        <TaskSidebarBody myself={myself} setOpenJoinProject={setOpenJoinProject} slices={slices} />
    );
};

type TaskSidebarBodyProps = {
    myself: UserProps;
    setOpenJoinProject: SetOpenJoinProject;
    slices: SidebarSlices;
};

const TaskSidebarBody = memo(function TaskSidebarBody(props: TaskSidebarBodyProps) {
    const { myself, setOpenJoinProject, slices } = props;
    // What this component itself reads. The other slices belong to the children
    // they are handed to: the task id the user has open is in this one and in
    // Recents' only, so the project / milestone tree does not re-render when it
    // changes.
    const { tm: useTM, pm: usePM } = slices.shell;
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

    // Recents = the tasks THIS user opened, newest open first (MIP-1063). The
    // server caps it at 20 per project and checks access on every read, so
    // there is no client-side slice: it would keep only the first project or two.
    const [recentTasks, setRecentTasks] = useState<SearchTeamTasksResponse[]>([]);
    const updateRecentTasks = () => {
        (async () => {
            const loadedTasks = await loadRecentTasks(myself, accessToken);
            // A failed request resolves to undefined; keep the last list.
            if (!loadedTasks) return;
            setRecentTasks([...loadedTasks]);
        })();
    };

    useEffect(() => {
        updateRecentTasks();
    }, [myself?.teamId, accessToken]);

    // An open is recorded by the task preview wherever it is shown (this sidebar
    // is not mounted for a modal or on mobile), then announced here.
    useOnTaskOpened(updateRecentTasks, RECENTS_RELOAD_DEBOUNCE_MS);

    // Changing the status of the task you have open doesn't change the
    // previewed id, so the effect above alone would leave its row showing the
    // old status.
    useOnTaskMetadataSaved(updateRecentTasks, RECENTS_RELOAD_DEBOUNCE_MS);

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
                    accessToken={accessToken}
                    loading={loading}
                    myself={myself}
                    openSearch={openSearch}
                    setOpenSearch={setOpenSearch}
                    setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                    teamTaskSearchOptions={teamTaskSearchOptions}
                    useTM={slices.search.tm}
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
                        gap: 0,
                        "--List-nestedInsetStart": "0px",
                    }}
                >
                    {/* Home Item */}
                    <NavItem
                        icon={<HomeRoundedIcon />}
                        label={t.tasks.sidebar.home}
                        selected={useTM.isTaskDashboardVisible}
                        onClick={() => {
                            useTM.setIsTaskDashboardVisible(true);
                            useTM.setIsTaskTableVisible(false);
                            useTM.setIsSprintBoardVisible(false);
                        }}
                    />

                    {/* Section Header - Views — Table and Sprint Board
                        aren't reachable on mobile (MobileTaskHome only
                        renders the dashboard or MobileTaskList), so the
                        whole Views section is dropped on xs. The flags
                        (`isTaskTableVisible` / `isSprintBoardVisible`)
                        still drive the desktop layout when the user
                        resizes back to ≥md. */}
                    {!isMobile && (
                        <>
                            <SectionHeader
                                as="div"
                                label={t.tasks.sidebar.viewsHeader}
                                sx={{ mt: 1.5 }}
                            />
                            <TaskTableListItem useTM={slices.tableView.tm} />
                            <SprintBoardListItem useTM={slices.boardView.tm} />
                        </>
                    )}

                    {/* Section Header - Tasks */}
                    <SectionHeader as="div" label={t.tasks.sidebar.tasksHeader} sx={{ mt: 1.5 }} />

                    <FavoritesListItem
                        usePM={slices.tree.pm}
                        useSM={slices.tree.sm}
                        useTM={slices.tree.tm}
                    />

                    <RecentsListItem
                        recentTasks={recentTasks}
                        usePM={slices.recents.pm}
                        useTM={slices.recents.tm}
                    />

                    {/* Section Header - Projects */}
                    <SectionHeader
                        as="div"
                        label={t.tasks.sidebar.projectsHeader}
                        sx={{ mt: 1.5 }}
                    />

                    <ProjectsListItem
                        myself={myself}
                        setOpenJoinProject={setOpenJoinProject}
                        useCM={slices.tree.cm}
                        usePM={slices.tree.pm}
                        useSM={slices.tree.sm}
                        useTEM={slices.tree.tem}
                        useTM={slices.tree.tm}
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
});
