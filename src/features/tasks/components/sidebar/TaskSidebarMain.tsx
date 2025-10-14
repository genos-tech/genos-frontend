import { useState, useEffect } from "react";
import { GlobalStyles, Box, Divider, List, Sheet } from "@mui/joy";
import { listItemButtonClasses } from "@mui/joy/ListItemButton";

import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { loadProjectTags } from "../../services/loadProjectTags";
import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";
import { TagListProps, SearchTeamTasksResponse } from "../../../../types/tasks";
import { TaskSidebarSearchBox } from "./SearchBox";
import { TaskTableListItem } from "./TaskTableListItem";
import { RecentsListItem } from "./RecentsListItem";
import { ProjectsListItem } from "./ProjectsListItem";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

type TaskSidebarProps = {
    myself: UserProps;
    setIsDashboardVisible: (value: boolean) => void;
    taskTableVisible: boolean;
    setTaskTableVisible: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    setIsTaskHomeVisible: (value: boolean) => void;
    setFilterBy: (value: number) => void;
    setSelectedTagForFiltering: (value: string) => void;
    setCurrentFilterName: (value: string) => void;
    PM: ProjectManagementState;
    TM: TaskManagementState;
};

export const TaskSidebar = (props: TaskSidebarProps) => {
    const {
        myself,
        setIsDashboardVisible,
        taskTableVisible,
        setTaskTableVisible,
        setOpenJoinProject,
        setIsTaskHomeVisible,
        setFilterBy,
        setSelectedTagForFiltering,
        setCurrentFilterName,
        PM,
        TM,
    } = props;
    const { accessToken } = useAuth();

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
        if (PM.currentProject && PM.currentProject.projectId) {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                PM.currentProject.projectId,
                accessToken
            );
            PM.setCurrentProject({
                ...PM.currentProject,
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
    }, [TM.currentPreviewTaskId]);

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
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "100%",
                top: 0,
                p: 2,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRight: "1px solid",
                borderColor: "divider",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--TaskSidebar-width": "220px",
                        [theme.breakpoints.up("lg")]: {
                            "--TaskSidebar-width": "240px",
                        },
                    },
                })}
            />

            <TaskSidebarSearchBox
                currentPreviewTaskId={TM.currentPreviewTaskId}
                openSearch={openSearch}
                setOpenSearch={setOpenSearch}
                teamTaskSearchOptions={teamTaskSearchOptions}
                setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                loading={loading}
                setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
            />

            <Box
                className="custom-scrollbar"
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 1.5,
                    },
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 1,
                        "--List-nestedInsetStart": "30px",
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                    }}
                >
                    {/* <DashboardListItem
                        setTaskTableVisible={setTaskTableVisible}
                        setIsDashboardVisible={setIsDashboardVisible}
                    /> */}

                    <TaskTableListItem
                        taskTableVisible={taskTableVisible}
                        setTaskTableVisible={setTaskTableVisible}
                        setIsDashboardVisible={setIsDashboardVisible}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                    />

                    <RecentsListItem
                        recentTasks={recentTasks}
                        setIsDashboardVisible={setIsDashboardVisible}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                        setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                    />

                    <ProjectsListItem
                        PM={PM}
                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                        setOpenJoinProject={setOpenJoinProject}
                        setSelectedTagForFiltering={setSelectedTagForFiltering}
                        setFilterBy={setFilterBy}
                        setCurrentFilterName={setCurrentFilterName}
                        TM={TM}
                    />
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
