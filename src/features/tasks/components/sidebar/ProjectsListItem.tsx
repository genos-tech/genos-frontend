import AccountTreeIcon from "@mui/icons-material/AccountTree";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import WorkIcon from "@mui/icons-material/Work";
import { List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { Toggler } from "./common";
import { JoinProjectListItem } from "./projects_subs/JoinProjectListItem";
import { NewProjectListItem } from "./projects_subs/NewProjectListItem";
import { OngoingsListItem } from "./projects_subs/OngoingsListItem";
import { TagsListItem } from "./projects_subs/TagsListItem";

type ProjectsListItemProps = {
    PM: ProjectManagementState;
    setIsTaskHomeVisible: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    setSelectedTagForFiltering: (value: string) => void;
    setFilterBy: (value: number) => void;
    setCurrentFilterName: (value: string) => void;
    TM: TaskManagementState;
};
export const ProjectsListItem = (props: ProjectsListItemProps) => {
    const {
        PM,
        setIsTaskHomeVisible,
        setOpenJoinProject,
        setSelectedTagForFiltering,
        setFilterBy,
        setCurrentFilterName,
        TM,
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
                                                sx={{ overflow: "hidden" }} // ensure children don't overflow
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
                                                        TM.setAllTasks([]);
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
                                                    }
                                                }}
                                            >
                                                <AccountTreeIcon />

                                                {isPrivate === true ? (
                                                    <LockOutlineIcon sx={{ mx: "-5px" }} />
                                                ) : null}

                                                <Typography
                                                    sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        width: "100%", // take full width of button
                                                    }}
                                                    noWrap
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
                                                setCurrentProject={PM.setCurrentProject}
                                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                TM={TM}
                                            />
                                            <TagsListItem
                                                currentProject={PM.currentProject}
                                                projectId={projectId}
                                                setCurrentFilterName={setCurrentFilterName}
                                                setFilterBy={setFilterBy}
                                                setSelectedTagForFiltering={
                                                    setSelectedTagForFiltering
                                                }
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
