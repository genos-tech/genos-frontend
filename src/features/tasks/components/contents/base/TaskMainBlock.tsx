import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import { Box, Chip, Grid, IconButton, List, ListItem, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/common/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { ProjectProps, TagListProps, TaskProps } from "../../../../../types/tasks";
import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { GeneralURLManager } from "./sub/GeneralURLManager";
import { GitHubURLManager } from "./sub/GitHubURLManager";
import { TaskDueDateInput } from "./sub/TaskDueDateInput";

type TaskMainBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    teamMembers: UserProps[];
    teamProjects: ProjectProps[];
    projectTags: TagListProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    assignee: UserProps;
    setAssignee: (value: UserProps) => void;
    reporter: UserProps;
    setReporter: (value: UserProps) => void;
    isOpenTeamMembersList: boolean;
    setIsOpenTeamMembersList: (value: boolean) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    isOpenTagList: boolean;
    setIsOpenTagList: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    isPreviewMode: boolean;
    setTaskUpdated?: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
};
export const TaskMainBlock = (props: TaskMainBlockProps) => {
    const {
        teamMemberProfiles,
        socket,
        taskContent,
        setTaskContent,
        teamMembers,
        teamProjects,
        projectTags,
        myself,
        setMyself,
        assignee,
        setAssignee,
        reporter,
        setReporter,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isOpenProjectList,
        setIsOpenProjectList,
        isOpenTagList,
        setIsOpenTagList,
        setOpenCreateTag,
        setCurrentProject,
        isPreviewMode,
        setTaskUpdated,
        setOpeningService,
        setCurrentMainChat,
        setCurrentPreviewTaskId,
        setTaskStatusUpdated,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();

    const [parentTask, setParentTask] = useState<TaskProps>();
    useEffect(() => {
        (async () => {
            if (taskContent.project && taskContent.parentTaskId != null) {
                const parentTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    taskContent.project.projectId,
                    taskContent.parentTaskId,
                    accessToken
                );
                if (parentTask.length == 1) {
                    setParentTask(parentTask[0]);
                } else {
                    setParentTask(undefined);
                }
            } else {
                setParentTask(undefined);
            }
        })();
    }, [taskContent]);

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <List aria-labelledby="decorated-list-demo">
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "65%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Assignee</Typography>
                        <AvatarWithStatus
                            avatarUser={teamMemberProfiles[assignee.userId]}
                            isYou={myself.userId === assignee.userId ? true : false}
                            myself={myself}
                            setCurrentMainChat={setCurrentMainChat}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                        />
                        <ACTeamUsers
                            initialUser={taskContent.assignee}
                            isAssignee={true}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setCurrentMainChat={setCurrentMainChat}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setAssignee}
                            socket={socket}
                            taskContent={taskContent}
                            teamMemberProfiles={teamMemberProfiles}
                            teamMembers={teamMembers}
                        />
                    </ListItem>
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "65%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Reporter</Typography>
                        <AvatarWithStatus
                            avatarUser={teamMemberProfiles[reporter.userId]}
                            isYou={myself.userId === reporter.userId ? true : false}
                            myself={myself}
                            setCurrentMainChat={setCurrentMainChat}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                        />
                        <ACTeamUsers
                            initialUser={taskContent.reporter}
                            isAssignee={false}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setCurrentMainChat={setCurrentMainChat}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setReporter}
                            socket={socket}
                            taskContent={taskContent}
                            teamMemberProfiles={teamMemberProfiles}
                            teamMembers={teamMembers}
                        />
                    </ListItem>
                    <Grid spacing={2} container>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Project</Typography>
                                <ACTeamProjects
                                    isOpenProjectList={isOpenProjectList}
                                    setCurrentProject={setCurrentProject}
                                    setIsOpenProjectList={setIsOpenProjectList}
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                    teamProjects={teamProjects}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "40px" }}>Tags</Typography>
                                <ACProjectTags
                                    isOpenTagList={isOpenTagList}
                                    projectTags={projectTags}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                                <IconButton
                                    color="neutral"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => {
                                        setOpenCreateTag(true);
                                    }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </ListItem>
                        </Grid>
                    </Grid>
                    <Grid spacing={2} container>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Priority</Typography>
                                <ACTaskPriority
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Effort Level</Typography>
                                <ACTaskEffortLevel
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
                            </ListItem>
                        </Grid>
                    </Grid>
                    {isPreviewMode === true && (
                        <ListItem sx={{ width: "49%" }}>
                            <Typography sx={{ minWidth: "80px" }}>Status</Typography>
                            <ACTaskStatus
                                setTaskContent={setTaskContent}
                                setTaskStatusUpdated={setTaskStatusUpdated}
                                setTaskUpdated={setTaskUpdated}
                                socket={socket}
                                taskContent={taskContent}
                            />
                        </ListItem>
                    )}
                    <ListItem>
                        <Typography sx={{ minWidth: "80px" }}>Due Date</Typography>
                        <TaskDueDateInput
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            taskContent={taskContent}
                        />
                    </ListItem>
                    <ListItem>
                        <GitHubURLManager
                            githubLink={taskContent.githubLink}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            taskContent={taskContent}
                        />
                    </ListItem>
                    <ListItem>
                        <GeneralURLManager
                            generalLink={taskContent.generalLink}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            taskContent={taskContent}
                        />
                    </ListItem>
                    {parentTask !== undefined ? (
                        <ListItem>
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="center"
                                spacing={0.5}
                            >
                                <Typography sx={{ pr: "5px" }}>Parent Task</Typography>
                                <AvatarWithStatus
                                    avatarUser={teamMemberProfiles[assignee.userId]}
                                    isYou={myself.userId === assignee.userId ? true : false}
                                    myself={myself}
                                    setCurrentMainChat={setCurrentMainChat}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    socket={socket}
                                />
                                <IconButton
                                    onClick={() => {
                                        if (
                                            parentTask.project &&
                                            parentTask.project.projectId &&
                                            parentTask.id
                                        ) {
                                            setCurrentProject({
                                                projectId: parentTask.project.projectId,
                                                projectName: parentTask.project.projectName,
                                                projectTags: parentTask.tags,
                                                systemUserId: parentTask.project.systemUserId,
                                            });
                                            setCurrentPreviewTaskId(parentTask.id);
                                        } else {
                                            console.error("Failed to set the current project");
                                        }
                                    }}
                                >
                                    <Chip
                                        color="neutral"
                                        size="md"
                                        variant="outlined"
                                        sx={{
                                            marginX: "5px",
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                        }}
                                    >
                                        {`${parentTask.id}`}
                                    </Chip>
                                    <Chip
                                        size="md"
                                        variant="soft"
                                        sx={{
                                            backgroundColor: parentTask.status.color
                                                ? alpha(
                                                      parentTask.status.color,
                                                      mode === "dark" ? 0.5 : 0.75
                                                  )
                                                : "transparent",
                                            color: parentTask.status.textColor,
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                        }}
                                    >
                                        {`${parentTask.status.status}`}
                                    </Chip>
                                    <Typography
                                        sx={{
                                            mx: "5px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            width: "100%", // take full width of button
                                        }}
                                        noWrap
                                    >
                                        {`${parentTask.title}`}
                                    </Typography>
                                </IconButton>
                            </Stack>
                        </ListItem>
                    ) : (
                        <div></div>
                    )}
                </List>
            </Box>
        </Box>
    );
};
