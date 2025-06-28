import { Socket } from "socket.io-client";
import { Box, Grid, IconButton, ListItem, List, Typography } from "@mui/joy";
import AddIcon from "@mui/icons-material/Add";

import { TaskDueDateInput } from "./sub/TaskDueDateInput";
import { GitHubURLManager } from "./sub/GitHubURLManager";
import { GeneralURLManager } from "./sub/GeneralURLManager";
import { ACProjectTags } from "../../autocompletes/ACProjectTags";
import { ACTeamUsers } from "../../autocompletes/ACTeamUsers";
import { ACTeamProjects } from "../../autocompletes/ACTeamProjects";
import { ACTaskPriority } from "../../autocompletes/ACTaskPriority";
import { ACTaskEffortLevel } from "../../autocompletes/ACTaskEffortLevel";
import { ACTaskStatus } from "../../autocompletes/ACTaskStatus";
import { TaskProps, ProjectProps, TagListProps } from "../../../../../types/tasks";
import { ChatProps } from "../../../../../types/chat";
import { UserProps } from "../../../../../types/admin";
import { AvatarWithStatus } from "../../../../../components/utils/avatarWithStatus";

type TaskMainBlockProps = {
    socket: Socket | null;
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    teamMembers: UserProps[];
    teamProjects: ProjectProps[];
    projectTags: TagListProps[];
    myself: UserProps;
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
};
export const TaskMainBlock = (props: TaskMainBlockProps) => {
    const {
        socket,
        taskContents,
        setTaskContents,
        teamMembers,
        teamProjects,
        projectTags,
        myself,
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
    } = props;

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
                        <Typography sx={{ minWidth: "80px" }}>Assignee:</Typography>
                        <AvatarWithStatus
                            userProfile={assignee}
                            socket={socket}
                            online={false}
                            setOpeningService={setOpeningService}
                            setCurrentMainChat={setCurrentMainChat}
                        />
                        <ACTeamUsers
                            myself={myself}
                            initialUser={taskContents.assignee}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUser={setAssignee}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={true}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>

                    <ListItem sx={{ display: "flex", alignItems: "center", width: "65%" }}>
                        <Typography sx={{ minWidth: "80px" }}>Reporter:</Typography>
                        <AvatarWithStatus
                            userProfile={reporter}
                            socket={socket}
                            online={false}
                            setOpeningService={setOpeningService}
                            setCurrentMainChat={setCurrentMainChat}
                        />
                        <ACTeamUsers
                            myself={myself}
                            initialUser={taskContents.reporter}
                            teamMembers={teamMembers}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            setUser={setReporter}
                            isOpenTeamMembersList={isOpenTeamMembersList}
                            setIsOpenTeamMembersList={setIsOpenTeamMembersList}
                            isAssignee={false}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>

                    <Grid container spacing={2}>
                        <Grid key={1} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "80px" }}>Project:</Typography>
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
                                <Typography sx={{ minWidth: "40px" }}>Tags:</Typography>
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
                                <Typography sx={{ minWidth: "80px" }}>Priority:</Typography>
                                <ACTaskPriority
                                    taskContents={taskContents}
                                    setTaskContents={setTaskContents}
                                    setTaskUpdated={setTaskUpdated}
                                />
                            </ListItem>
                        </Grid>
                        <Grid key={2} xs={6}>
                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Effort Level:</Typography>
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
                            <Typography sx={{ minWidth: "80px" }}>Status:</Typography>
                            <ACTaskStatus
                                taskContents={taskContents}
                                setTaskContents={setTaskContents}
                                setTaskUpdated={setTaskUpdated}
                            />
                        </ListItem>
                    )}

                    <ListItem>
                        <Typography sx={{ minWidth: "80px" }}>Due Date:</Typography>
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
                            isPreviewMode={isPreviewMode}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>
                    <ListItem>
                        <GeneralURLManager
                            generalLink={taskContents.generalLink}
                            taskContents={taskContents}
                            setTaskContents={setTaskContents}
                            isPreviewMode={isPreviewMode}
                            setTaskUpdated={setTaskUpdated}
                        />
                    </ListItem>
                </List>
            </Box>
        </Box>
    );
};
