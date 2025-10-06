import { alpha } from "@mui/system";
import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Box, Grid, IconButton, ListItem, List, Typography, Chip, Stack } from "@mui/joy";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/joy/styles";

import { TaskDueDateInput } from "./sub/TaskDueDateInput";
import { GitHubURLManager } from "./sub/GitHubURLManager";
import { GeneralURLManager } from "./sub/GeneralURLManager";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { TaskProps, ProjectProps, TagListProps } from "../../../../../types/tasks";
import { ChatProps } from "../../../../../types/chat";
import { UserProps } from "../../../../../types/admin";
import { AvatarWithStatus } from "../../../../../components/common/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";

type TaskMainBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
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
        taskContents,
        setTaskContents,
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
            if (taskContents.project && taskContents.parentTaskId != null) {
                const parentTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    taskContents.project.projectId,
                    taskContents.parentTaskId,
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
    }, [taskContents]);

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
                            myself={myself}
                            setMyself={setMyself}
                            isYou={myself.userId === assignee.userId ? true : false}
                            avatarUser={teamMemberProfiles[assignee.userId]}
                            socket={socket}
                            setOpeningService={setOpeningService}
                            setCurrentMainChat={setCurrentMainChat}
                        />
                        <ACTeamUsers
                            myself={myself}
                            setMyself={setMyself}
                            initialUser={taskContents.assignee}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUser={setAssignee}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={true}
                            setTaskUpdated={setTaskUpdated}
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            setCurrentMainChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                        />
                    </ListItem>
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "65%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Reporter</Typography>
                        <AvatarWithStatus
                            myself={myself}
                            setMyself={setMyself}
                            isYou={myself.userId === reporter.userId ? true : false}
                            avatarUser={teamMemberProfiles[reporter.userId]}
                            socket={socket}
                            setOpeningService={setOpeningService}
                            setCurrentMainChat={setCurrentMainChat}
                        />
                        <ACTeamUsers
                            myself={myself}
                            setMyself={setMyself}
                            initialUser={taskContents.reporter}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUser={setReporter}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={false}
                            setTaskUpdated={setTaskUpdated}
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            setCurrentMainChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                        />
                    </ListItem>
                    <Grid container spacing={2}>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Project</Typography>
                                <ACTeamProjects
                                    teamProjects={teamProjects}
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    isOpenProjectList={isOpenProjectList}
                                    setIsOpenProjectList={setIsOpenProjectList}
                                    setCurrentProject={setCurrentProject}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "40px" }}>Tags</Typography>
                                <ACProjectTags
                                    projectTags={projectTags}
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    isOpenTagList={isOpenTagList}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setTaskUpdated={setTaskUpdated}
                                />
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="neutral"
                                    onClick={() => {
                                        setOpenCreateTag(true);
                                    }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </ListItem>
                        </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Priority</Typography>
                                <ACTaskPriority
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Effort Level</Typography>
                                <ACTaskEffortLevel
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                    </Grid>
                    {isPreviewMode === true && (
                        <ListItem sx={{ width: "49%" }}>
                            <Typography sx={{ minWidth: "80px" }}>Status</Typography>
                            <ACTaskStatus
                                socket={socket}
                                taskContents={taskContents}
                                setTaskContents={setTaskContents}
                                setTaskUpdated={setTaskUpdated}
                                setTaskStatusUpdated={setTaskStatusUpdated}
                            />
                        </ListItem>
                    )}
                    <ListItem>
                        <Typography sx={{ minWidth: "80px" }}>Due Date</Typography>
                        <TaskDueDateInput
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>
                    <ListItem>
                        <GitHubURLManager
                            githubLink={taskContents.githubLink}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>
                    <ListItem>
                        <GeneralURLManager
                            generalLink={taskContents.generalLink}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>
                    {parentTask !== undefined ? (
                        <ListItem>
                            <Stack
                                direction="row"
                                spacing={0.5}
                                justifyContent="center"
                                alignItems="center"
                            >
                                <Typography sx={{ pr: "5px" }}>Parent Task</Typography>
                                <AvatarWithStatus
                                    myself={myself}
                                    setMyself={setMyself}
                                    isYou={myself.userId === assignee.userId ? true : false}
                                    avatarUser={teamMemberProfiles[assignee.userId]}
                                    socket={socket}
                                    setOpeningService={setOpeningService}
                                    setCurrentMainChat={setCurrentMainChat}
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
                                        variant="outlined"
                                        color="neutral"
                                        sx={{
                                            marginX: "5px",
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                        }}
                                        size="md"
                                    >
                                        {`${parentTask.id}`}
                                    </Chip>
                                    <Chip
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
                                        size="md"
                                    >
                                        {`${parentTask.status.status}`}
                                    </Chip>
                                    <Typography
                                        noWrap
                                        sx={{
                                            mx: "5px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            width: "100%", // take full width of button
                                        }}
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
