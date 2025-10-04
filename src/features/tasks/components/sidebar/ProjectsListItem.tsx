import { List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import WorkIcon from "@mui/icons-material/Work";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import LockOutlineIcon from "@mui/icons-material/LockOutline";

import { ProjectProps, TaskMetaTreeNode, TaskTableProps } from "../../../../types/tasks";
import { Toggler } from "./common";
import { OngoingsListItem } from "./projects_subs/OngoingsListItem";
import { TagsListItem } from "./projects_subs/TagsListItem";
import { JoinProjectListItem } from "./projects_subs/JoinProjectListItem";
import { NewProjectListItem } from "./projects_subs/NewProjectListItem";

type ProjectsListItemProps = {
    teamProjects: ProjectProps[];
    setCurrentProject: (value: ProjectProps) => void;
    setIsTaskHomeVisible: (value: boolean) => void;
    setOngoingTasks: (value: TaskTableProps[]) => void;
    setClosedTasks: (value: TaskTableProps[]) => void;
    setDeletedTasks: (value: TaskTableProps[]) => void;
    currentProject: ProjectProps | null;
    loadProjectsAndTasks: (value: number) => Promise<void>;
    setOpenCreateProject: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    setSelectedTagForFiltering: (value: string) => void;
    setFilterBy: (value: number) => void;
    taskMetaTree: TaskMetaTreeNode[];
    currentTaskChain?: TaskMetaTreeNode[];
    currentPreviewTaskId: number;
    setCurrentFilterName: (value: string) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
};
export const ProjectsListItem = (props: ProjectsListItemProps) => {
    const {
        teamProjects,
        setCurrentProject,
        setIsTaskHomeVisible,
        setOngoingTasks,
        setClosedTasks,
        setDeletedTasks,
        currentProject,
        loadProjectsAndTasks,
        setOpenCreateProject,
        setOpenJoinProject,
        setSelectedTagForFiltering,
        setFilterBy,
        taskMetaTree,
        currentTaskChain,
        currentPreviewTaskId,
        setCurrentFilterName,
        setIsTaskPreviewVisible,
        setCurrentPreviewTaskId,
        setIsCreatingTask,
    } = props;

    return (
        <ListItem nested>
            <Toggler
                key={`toggler-TeamProjects`}
                defaultExpanded={true}
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
                        color="primary"
                        onClick={() => {
                            setOpen(!open);
                        }}
                    >
                        <WorkIcon />
                        <ListItemContent>
                            <Typography
                                level="title-sm"
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Projects
                            </Typography>
                        </ListItemContent>
                        <KeyboardArrowDownIcon
                            sx={[
                                open
                                    ? {
                                          transform: "rotate(180deg)",
                                      }
                                    : {
                                          transform: "none",
                                      },
                            ]}
                        />
                    </ListItemButton>
                )}
            >
                <List>
                    {teamProjects.map(
                        (
                            {
                                projectId,
                                projectName,
                                projectTags,
                                isPrivate,
                                systemUserId,
                                isJoined,
                            },
                            index
                        ) => {
                            return (
                                isJoined === true && (
                                    <Toggler
                                        key={`toggler-TeamProjects-${projectId}-${index}`}
                                        defaultExpanded={false}
                                        renderToggle={({ open, setOpen }) => (
                                            <ListItemButton
                                                color={"primary"}
                                                variant={
                                                    projectId === currentProject?.projectId
                                                        ? "soft"
                                                        : "plain"
                                                }
                                                onClick={() => {
                                                    setOpen(!open);
                                                    setIsTaskHomeVisible(true);

                                                    // Reset the task table...
                                                    setOngoingTasks([]);
                                                    setClosedTasks([]);
                                                    setDeletedTasks([]);

                                                    (async () => {
                                                        await loadProjectsAndTasks(projectId);
                                                        // This will be executed in the loadProjectsAndTasks,
                                                        // but somehow this needs to update the task table...
                                                        setCurrentProject({
                                                            projectId: projectId,
                                                            projectName: projectName,
                                                            projectTags: projectTags,
                                                            isPrivate: isPrivate,
                                                            systemUserId: systemUserId,
                                                        });
                                                    })();
                                                }}
                                                sx={{ overflow: "hidden" }} // ensure children don't overflow
                                            >
                                                <AccountTreeIcon />
                                                {isPrivate === true ? <LockOutlineIcon /> : null}
                                                <Typography
                                                    noWrap
                                                    sx={{
                                                        color:
                                                            projectId === currentProject?.projectId
                                                                ? "white"
                                                                : "neutral-500",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        width: "100%", // take full width of button
                                                    }}
                                                >
                                                    {projectName}
                                                </Typography>
                                                <KeyboardArrowDownIcon
                                                    sx={[
                                                        open
                                                            ? {
                                                                  transform: "rotate(180deg)",
                                                              }
                                                            : {
                                                                  transform: "none",
                                                              },
                                                    ]}
                                                />
                                            </ListItemButton>
                                        )}
                                    >
                                        <List>
                                            <OngoingsListItem
                                                currentProjectId={projectId}
                                                projectTags={projectTags}
                                                taskMetaTree={taskMetaTree}
                                                currentTaskChain={currentTaskChain}
                                                currentPreviewTaskId={currentPreviewTaskId}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setCurrentProject={setCurrentProject}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                            />
                                            <TagsListItem
                                                projectId={projectId}
                                                currentProject={currentProject}
                                                setSelectedTagForFiltering={
                                                    setSelectedTagForFiltering
                                                }
                                                setFilterBy={setFilterBy}
                                                setCurrentFilterName={setCurrentFilterName}
                                            />
                                        </List>
                                    </Toggler>
                                )
                            );
                        }
                    )}

                    <JoinProjectListItem
                        teamProjects={teamProjects}
                        currentProject={currentProject}
                        setOpenJoinProject={setOpenJoinProject}
                    />

                    <NewProjectListItem setOpenCreateProject={setOpenCreateProject} />
                </List>
            </Toggler>
        </ListItem>
    );
};
