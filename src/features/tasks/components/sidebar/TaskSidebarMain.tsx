import { useEffect, useState } from "react";
import { Box, Divider, GlobalStyles, List, Sheet } from "@mui/joy";
import { listItemButtonClasses } from "@mui/joy/ListItemButton";

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
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "100%",
                top: 0,
                p: 2,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
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
                loading={loading}
                openSearch={openSearch}
                setOpenSearch={setOpenSearch}
                setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                teamTaskSearchOptions={teamTaskSearchOptions}
                useTM={useTM}
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
                        setIsDashboardVisible={setIsDashboardVisible}
                    /> */}

                    <SprintBoardListItem useTM={useTM} />

                    <TaskTableListItem useTM={useTM} />

                    <RecentsListItem recentTasks={recentTasks} useTM={useTM} usePM={usePM} />

                    <ProjectsListItem
                        usePM={usePM}
                        setIsTaskHomeVisible={useTM.setIsTaskHomeVisible}
                        setOpenJoinProject={setOpenJoinProject}
                        useTM={useTM}
                    />
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
