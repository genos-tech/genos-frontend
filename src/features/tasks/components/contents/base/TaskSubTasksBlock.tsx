import { useEffect, useState } from "react";
import { Box, Chip, Divider, List, ListItem, ListItemButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/common/avatarWithStatus";
import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { ProjectProps, TaskProps } from "../../../../../types/tasks";
import { loadSpecificChildTasks } from "../../../services/loadSpecificChildTasks";

type TaskSubTasksBlockProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentPreviewTaskId: number;
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
        currentPreviewTaskId,
        currentTaskContent,
        setCurrentProject,
        setCurrentPreviewTaskId,
        setOpeningService,
        setCurrentMainChat,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const [childTasks, setChildTasks] = useState<TaskProps[]>([]);

    useEffect(() => {
        (async () => {
            // Get the child tasks if exist
            if (currentTaskContent.project && currentPreviewTaskId === currentTaskContent.id) {
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
            <Typography level="h4" sx={{ mt: 1, mb: 1 }}>
                Sub Tasks
            </Typography>
            <Stack
                className="custom-scrollbar"
                direction="row"
                sx={{
                    width: "100%",
                    minHeight: "40px",
                    maxHeight: "200px",
                    overflowY: "scroll",
                }}
            >
                <ListItem sx={{ width: "100%" }} nested>
                    <List sx={{ gap: 0.5 }}>
                        {childTasks.map(
                            ({ assignee, project, id, title, status, tags }, index) => {
                                return (
                                    <ListItem key={`listitem-${id}-${index}`}>
                                        <AvatarWithStatus
                                            avatarUser={teamMemberProfiles[assignee.userId]}
                                            myself={myself}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            socket={socket}
                                            isYou={
                                                myself.userId === assignee.userId ? true : false
                                            }
                                        />
                                        <ListItemButton
                                            sx={{
                                                marginLeft: "10px",
                                            }}
                                            onClick={() => {
                                                if (project && project.projectId && id) {
                                                    // setCurrentProject({
                                                    //     projectId: project.projectId,
                                                    //     projectName: project.projectName,
                                                    //     projectTags: project.projectTags || [],
                                                    //     systemUserId: project.systemUserId,
                                                    // });
                                                    setCurrentPreviewTaskId(id);
                                                } else {
                                                    console.error(
                                                        "Failed to set the current project"
                                                    );
                                                }
                                            }}
                                        >
                                            <Chip
                                                key={`id-chip-${id}-${index}`} // pass the key directly
                                                color="neutral"
                                                size="md"
                                                variant="outlined"
                                                sx={{
                                                    fontWeight: "bold",
                                                    borderRadius: "5px",
                                                }}
                                            >
                                                {`${id}`}
                                            </Chip>
                                            <Chip
                                                key={`status-chip-${id}-${index}`} // pass the key directly
                                                size="md"
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
                                            >
                                                {`${status.status}`}
                                            </Chip>
                                            <Typography
                                                sx={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    width: "100%", // take full width of button
                                                }}
                                                noWrap
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
                                                        size="md"
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
            <Divider sx={{ mt: 1, mb: 2 }} />
        </>
    ) : (
        <></>
    );
};
