import { alpha } from "@mui/system";
import { Tooltip, Stack, Typography, IconButton, Chip } from "@mui/joy";
import CancelIcon from "@mui/icons-material/Cancel";
import ReplyIcon from "@mui/icons-material/Reply";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsMainChatVisible: (chat: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    currentPreviewTask?: TaskProps;
    currentPreviewTaskId: number;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const {
        myself,
        thread,
        setCurrentThreadChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsOpeningTask,
        setIsCreatingTask,
        currentPreviewTask,
        currentPreviewTaskId,
    } = props;
    const { mode } = useColorScheme();

    let isYou: boolean = false;
    if (thread.dmPartnerUser !== null) {
        isYou = myself.userId === thread.dmPartnerUser.userId;
    }

    const dummyThreadChat: ThreadProps = {
        chatId: thread.chatId,
        chatName: thread.chatName,
        threadId: thread.threadId,
        isDm: thread.isDm,
        chatType: thread.chatType,
        dmPartnerUser: thread.dmPartnerUser,
        taskId: thread.taskId,
        unread: false,
        messages: [],
        TSLastMessage: thread.TSLastMessage,
    };

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: "space-between",
                py: { xs: 2, md: 2 },
                px: { xs: 1, md: 2 },
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.body",
                height: "60px",
            }}
        >
            <Stack direction="row" spacing={{ xs: 0.5, md: 0.5 }} sx={{ alignItems: "center" }}>
                <Chip
                    size="lg"
                    variant="solid"
                    color="neutral"
                    startDecorator={<ReplyIcon />}
                    sx={{ borderRadius: "4px" }}
                >
                    Thread
                </Chip>

                {/* Custom header in PM and DM/GM (having a task) thread */}
                {(((thread.chatType === 3 || thread.chatType === 4) &&
                    currentPreviewTaskId !== -1) ||
                    (isTaskPreviewVisible === false &&
                        currentPreviewTaskId !== -1 &&
                        currentPreviewTask &&
                        thread.taskExist === true)) && (
                    <>
                        <Chip
                            key={thread.taskId}
                            variant="soft"
                            color="neutral"
                            sx={{
                                borderRadius: "7px",
                                fontWeight: "bold",
                            }}
                            size="lg"
                        >
                            ID: {thread.taskId || "N/A"}
                        </Chip>
                        {currentPreviewTask && (
                            <>
                                <Chip
                                    size="lg"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: currentPreviewTask.status.color
                                            ? alpha(
                                                  currentPreviewTask.status.color,
                                                  mode === "dark" ? 0.5 : 0.75
                                              )
                                            : "transparent",
                                        color: currentPreviewTask.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "7px",
                                    }}
                                >
                                    {currentPreviewTask.status.status || "N/A"}
                                </Chip>
                            </>
                        )}
                    </>
                )}
                <div>
                    <Typography
                        component="h2"
                        noWrap
                        sx={{ fontWeight: "lg", fontSize: "lg", pl: "5px" }}
                    >
                        {isYou ? `${thread?.chatName} (you)` : thread?.chatName}
                    </Typography>
                </div>
            </Stack>

            <Stack spacing={1} direction="row" sx={{ alignItems: "center" }}>
                {/* Custom header in DM/GM thread */}
                {thread.chatType !== 3 && thread.chatType !== 4 && currentPreviewTaskId === -1 && (
                    <>
                        <Tooltip title="New Task" size="sm">
                            <IconButton
                                component="a"
                                size="md"
                                variant="plain"
                                color="neutral"
                                onClick={() => {
                                    setIsMainChatVisible(true);
                                    setIsThreadVisible(true);
                                    setIsTaskPreviewVisible(false);
                                    setIsTaskCreationVisible(true);

                                    setIsCreatingTask(true);
                                }}
                            >
                                <PlaylistAddIcon />
                            </IconButton>
                        </Tooltip>
                    </>
                )}

                <Tooltip title="Open Task" size="sm">
                    <IconButton
                        size="sm"
                        onClick={() => {
                            setIsMainChatVisible(true);
                            setIsThreadVisible(true);
                            setIsTaskPreviewVisible(true);
                            setIsTaskCreationVisible(false);
                            setIsOpeningTask(true);
                        }}
                    >
                        <OpenInNewIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Close Thread" size="sm">
                    <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => {
                            setIsMainChatVisible(true);
                            setIsThreadVisible(false);
                            // setIsTaskPreviewVisible(); // Not update, keep as it is !!!
                            // setIsTaskCreationVisible(); // Not update, keep as it is !!!
                            setCurrentThreadChat(dummyThreadChat);
                        }}
                    >
                        <CancelIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
};
