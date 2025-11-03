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

type ProjectsListItemProps = {
    usePM: ProjectManagementState;
    setIsTaskHomeVisible: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    useTM: TaskManagementState;
};
export const ProjectsListItem = (props: ProjectsListItemProps) => {
    const { usePM, setIsTaskHomeVisible, setOpenJoinProject, useTM } = props;

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
                    {usePM.teamProjects.map(
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
                                                    projectId === usePM.currentProject?.projectId
                                                        ? "soft"
                                                        : "plain"
                                                }
                                                onClick={() => {
                                                    setOpen(!open);
                                                    setIsTaskHomeVisible(true);

                                                    // Only if the clicked project id is not the same as the current one,
                                                    // reset the project (and load tasks in the downstream step.)
                                                    if (
                                                        projectId !==
                                                        usePM.currentProject?.projectId
                                                    ) {
                                                        // Reset the task table...
                                                        useTM.setAllTasks([]);
                                                        (async () => {
                                                            await usePM.loadProjectsAndTasks(
                                                                projectId
                                                            );
                                                            // This will be executed in the loadProjectsAndTasks,
                                                            // but somehow this needs to update the task table...
                                                            usePM.setCurrentProject({
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
                                                useTM={useTM}
                                            />
                                        </List>
                                    </Toggler>
                                )
                            );
                        }
                    )}

                    <JoinProjectListItem usePM={usePM} setOpenJoinProject={setOpenJoinProject} />

                    <NewProjectListItem usePM={usePM} />
                </List>
            </Toggler>
        </ListItem>
    );
};
