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
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";

type ProjectsListItemProps = {
    PM: ProjectManagementState;

    setIsTaskHomeVisible: (value: boolean) => void;
    setOngoingTasks: (value: TaskTableProps[]) => void;
    setClosedTasks: (value: TaskTableProps[]) => void;
    setDeletedTasks: (value: TaskTableProps[]) => void;
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
        PM,
        setIsTaskHomeVisible,
        setOngoingTasks,
        setClosedTasks,
        setDeletedTasks,
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
                    {PM.teamProjects.map(
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
                                                    projectId === PM.currentProject?.projectId
                                                        ? "soft"
                                                        : "plain"
                                                }
                                                onClick={() => {
                                                    setOpen(!open);
                                                    setIsTaskHomeVisible(true);

                                                    // Only if the clicked project id is not the same as the current one,
                                                    // reset the project (and load tasks in the downstream step.)
                                                    if (
                                                        projectId !== PM.currentProject?.projectId
                                                    ) {
                                                        // Reset the task table...
                                                        setOngoingTasks([]);
                                                        setClosedTasks([]);
                                                        setDeletedTasks([]);
                                                        (async () => {
                                                            await PM.loadProjectsAndTasks(
                                                                projectId
                                                            );
                                                            // This will be executed in the loadProjectsAndTasks,
                                                            // but somehow this needs to update the task table...
                                                            PM.setCurrentProject({
                                                                projectId: projectId,
                                                                projectName: projectName,
                                                                projectTags: projectTags,
                                                                isPrivate: isPrivate,
                                                                systemUserId: systemUserId,
                                                            });
                                                        })();
                                                    } else {
                                                        console.error(
                                                            "Failed to set the current project"
                                                        );
                                                    }
                                                }}
                                                sx={{ overflow: "hidden" }} // ensure children don't overflow
                                            >
                                                <AccountTreeIcon />

                                                {isPrivate === true ? (
                                                    <LockOutlineIcon sx={{ mx: "-5px" }} />
                                                ) : null}

                                                <Typography
                                                    noWrap
                                                    sx={{
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
                                                setCurrentProject={PM.setCurrentProject}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                            />
                                            <TagsListItem
                                                projectId={projectId}
                                                currentProject={PM.currentProject}
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

                    <JoinProjectListItem PM={PM} setOpenJoinProject={setOpenJoinProject} />

                    <NewProjectListItem setOpenCreateProject={PM.setOpenCreateProject} />
                </List>
            </Toggler>
        </ListItem>
    );
};
