import { Socket } from "socket.io-client";
import { alpha } from "@mui/system";
import { useState, useEffect } from "react";
import { Box, List, ListItem, Typography, Stack, Divider, Chip } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { loadSpecificTask } from "../../../services/loadSpecificTask";
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";
import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { TaskProps, ProjectProps } from "../../../../../types/tasks";
import { ChatProps } from "../../../../../types/chat";
import { AvatarWithStatus } from "../../../../../components/utils/avatarWithStatus";

type TaskSubTasksBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentTaskContent: TaskProps;
    setCurrentProject: (value: ProjectProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
};
export const TaskSubTasksBlock = (props: TaskSubTasksBlockProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        currentTaskContent,
        setCurrentProject,
        setCurrentPreviewTaskId,
        setOpeningService,
        setCurrentMainChat,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const [parentTask, setParentTask] = useState<TaskProps>();
    const [childTasks, setChildTasks] = useState<TaskProps[]>([]);

    useEffect(() => {
        (async () => {
            if (currentTaskContent.project && currentTaskContent.parentTaskId) {
                const parentTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    currentTaskContent.project.projectId,
                    currentTaskContent.parentTaskId,
                    accessToken
                );
                if (parentTask.length == 1) {
                    setParentTask(parentTask[0]);
                } else {
                    setParentTask(undefined);
                }
            }

            if (currentTaskContent.project && currentTaskContent.id) {
                const childTasks: TaskProps[] = await loadSpecificChildTasks(
                    myself,
                    currentTaskContent.project.projectId,
                    currentTaskContent.id,
                    accessToken
                );
                if (childTasks.length > 0) {
                    setChildTasks(childTasks);
                } else {
                    setChildTasks([]);
                }
            }
        })();
    }, [currentTaskContent]);

    return childTasks.length > 0 ? (
        <>
            <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                Sub Tasks
            </Typography>
            <Stack
                className="custom-scrollbar"
                direction="row"
                sx={{
                    width: "100%",
                    maxHeight: "200px",
                    overflowY: "scroll",
                }}
            >
                <ListItem nested sx={{ width: "100%" }}>
                    <List sx={{ gap: 0.5 }}>
                        {childTasks.map(
                            ({ assignee, project, id, title, status, tags }, index) => {
                                return (
                                    <ListItem key={`listitem-${id}-${index}`}>
                                        <AvatarWithStatus
                                            myself={myself}
                                            setMyself={setMyself}
                                            avatarUser={teamMemberProfiles[assignee.userId]}
                                            socket={socket}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                        <ListItemButton
                                            onClick={() => {
                                                if (project && id) {
                                                    setCurrentProject({
                                                        projectId: project.projectId,
                                                        projectName: project.projectName,
                                                        projectTags: project.projectTags || [],
                                                        systemUserId: project.systemUserId,
                                                    });
                                                    setCurrentPreviewTaskId(id);
                                                }
                                            }}
                                        >
                                            <Chip
                                                key={`id-chip-${id}-${index}`} // pass the key directly
                                                variant="outlined"
                                                color="neutral"
                                                sx={{
                                                    marginX: "5px",
                                                    fontWeight: "bold",
                                                    borderRadius: "5px",
                                                }}
                                                size="md"
                                            >
                                                {`${id}`}
                                            </Chip>
                                            <Chip
                                                key={`status-chip-${id}-${index}`} // pass the key directly
                                                variant="soft"
                                                sx={{
                                                    marginX: "5px",
                                                    backgroundColor: status.color
                                                        ? alpha(
                                                              status.color,
                                                              mode === "dark" ? 0.5 : 0.75
                                                          )
                                                        : "transparent",
                                                    color: status.textColor,
                                                    fontWeight: "bold",
                                                    borderRadius: "5px",
                                                }}
                                                size="md"
                                            >
                                                {`${status.status}`}
                                            </Chip>
                                            <Typography
                                                noWrap
                                                sx={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    width: "100%", // take full width of button
                                                }}
                                            >
                                                {`${title}`}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    marginLeft: "auto",
                                                    alignItems: "center",
                                                }}
                                            >
                                                {tags.map(({ tagName, tagColor }, index) => (
                                                    <Chip
                                                        key={`${id}-${index}-${tagName}`}
                                                        variant="outlined"
                                                        sx={{
                                                            marginX: "2px",
                                                            color:
                                                                mode === "dark"
                                                                    ? "white"
                                                                    : "black",
                                                            fontWeight: "bold",
                                                            borderRadius: "5px",
                                                            borderWidth: "3px",
                                                            borderColor: alpha(
                                                                tagColor,
                                                                mode === "dark" ? 0.5 : 0.75
                                                            ),
                                                        }}
                                                        size="md"
                                                    >
                                                        {`${tagName}`}
                                                    </Chip>
                                                ))}
                                            </Box>
                                        </ListItemButton>
                                    </ListItem>
                                );
                            }
                        )}
                    </List>
                </ListItem>
            </Stack>
            <Divider sx={{ mt: 2 }} />
        </>
    ) : (
        <></>
    );
};
