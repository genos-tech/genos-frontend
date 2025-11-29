import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import { Box, Chip, Grid, IconButton, List, ListItem, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { ProjectProps, TagListProps, TaskProps } from "../../../../../types/tasks";
import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { DynamicURLManager } from "./sub/DynamicURLManager";
import { TaskDueDateInput } from "./sub/TaskDueDateInput";

type TaskMainBlockProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
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
    isPreviewMode: boolean;
    setTaskUpdated?: (value: boolean) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    setTaskStatusUpdated?: (value: boolean) => void;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
};
export const TaskMainBlock = (props: TaskMainBlockProps) => {
    const {
        useTEM,
        socket,
        taskContent,
        setTaskContent,
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
        isPreviewMode,
        setTaskUpdated,
        useUISM,
        useCM,
        useTM,
        setTaskStatusUpdated,
        usePM,
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
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Assignee</Typography>
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[assignee.userId]}
                            useCM={useCM}
                            isYou={myself.userId === assignee.userId ? true : false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useUISM={useUISM}
                        />
                        <ACTeamUsers
                            useCM={useCM}
                            initialUser={taskContent.assignee}
                            isAssignee={true}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setAssignee}
                            socket={socket}
                            taskContent={taskContent}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </ListItem>
                    <ListItem sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Reporter</Typography>
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[reporter.userId]}
                            useCM={useCM}
                            isYou={myself.userId === reporter.userId ? true : false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useUISM={useUISM}
                        />
                        <ACTeamUsers
                            useCM={useCM}
                            initialUser={taskContent.reporter}
                            isAssignee={false}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            myself={myself}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            setMyself={setMyself}
                            setTaskContent={setTaskContent}
                            setTaskUpdated={setTaskUpdated}
                            setUser={setReporter}
                            socket={socket}
                            taskContent={taskContent}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </ListItem>
                    <Grid spacing={2} container>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Project</Typography>
                                <ACTeamProjects
                                    isOpenProjectList={isOpenProjectList}
                                    setIsOpenProjectList={setIsOpenProjectList}
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                    usePM={usePM}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ width: "30px" }}>Tags</Typography>
                                <Tooltip size="sm" title="Create a New Tag" variant="outlined">
                                    <IconButton
                                        color="neutral"
                                        size="sm"
                                        variant="soft"
                                        onClick={() => {
                                            useTM.setOpenCreateTag(true);
                                        }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </Tooltip>
                                <ACProjectTags
                                    isOpenTagList={isOpenTagList}
                                    projectTags={projectTags}
                                    setIsOpenTagList={setIsOpenTagList}
                                    setTaskContent={setTaskContent}
                                    setTaskUpdated={setTaskUpdated}
                                    taskContent={taskContent}
                                />
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
                        <Typography sx={{ minWidth: "80px" }}>Links</Typography>
                        <DynamicURLManager
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
                                    avatarUser={useTEM.teamMemberProfiles[assignee.userId]}
                                    useCM={useCM}
                                    isYou={myself.userId === assignee.userId ? true : false}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useUISM={useUISM}
                                />
                                <IconButton
                                    onClick={() => {
                                        if (
                                            parentTask.project &&
                                            parentTask.project.projectId &&
                                            parentTask.id
                                        ) {
                                            usePM.setCurrentProject({
                                                projectId: parentTask.project.projectId,
                                                projectName: parentTask.project.projectName,
                                                projectTags: parentTask.tags,
                                                systemUserId: parentTask.project.systemUserId,
                                            });
                                            useTM.setCurrentPreviewTaskId(parentTask.id);
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
