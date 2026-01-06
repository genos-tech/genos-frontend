import { useEffect, useState } from "react";
import { Box, Divider, List, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
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
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

export const TaskSidebar = (props: TaskSidebarProps) => {
    const { myself, setOpenJoinProject, usePM, useTM } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,pending",
                -1,
                accessToken,
                true
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

    const updateProjectTags = async () => {
        if (usePM.currentProject && usePM.currentProject.projectId) {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                usePM.currentProject.projectId,
                accessToken
            );
            usePM.setCurrentProject({
                ...usePM.currentProject,
                projectTags: loadedProjectTags,
            });
        } else {
            console.error("Failed to set the current project");
        }
    };

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

    useEffect(() => {
        updateProjectTags();
    }, [myself]);

    return (
        <Sheet
            className="TaskSidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                height: "100dvh",
                width: "100%",
                top: 0,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
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
                className="custom-scrollbar"
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
                    {/* Section Header - Views */}
                    <Box sx={{ pt: 0.5, pb: 0.5, px: 1 }}>
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
                            Views
                        </Typography>
                    </Box>

                    <SprintBoardListItem useTM={useTM} />

                    <TaskTableListItem useTM={useTM} />

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
                            Tasks
                        </Typography>
                    </Box>

                    <RecentsListItem recentTasks={recentTasks} useTM={useTM} usePM={usePM} />

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
                            Projects
                        </Typography>
                    </Box>

                    <ProjectsListItem
                        usePM={usePM}
                        setIsTaskHomeVisible={useTM.setIsTaskHomeVisible}
                        setOpenJoinProject={setOpenJoinProject}
                        useTM={useTM}
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
                    Stay productive
                </Typography>
            </Box>
        </Sheet>
    );
};
