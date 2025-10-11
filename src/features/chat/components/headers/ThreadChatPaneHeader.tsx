import { alpha } from "@mui/system";
import { Tooltip, Stack, Typography, IconButton, Chip } from "@mui/joy";
import CancelIcon from "@mui/icons-material/Cancel";
import ReplyIcon from "@mui/icons-material/Reply";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { useColorScheme } from "@mui/joy/styles";
import NoteAltIcon from "@mui/icons-material/NoteAlt";

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
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setIsOpeningTask?: (value: boolean) => void;
    currentPreviewTask?: TaskProps;
    currentPreviewTaskId: number;
    isChatNoteVisible: boolean;
    setIsChatNoteVisible: (value: boolean) => void;
    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
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
        isCreatingTask,
        setIsOpeningTask,
        setIsCreatingTask,
        currentPreviewTask,
        currentPreviewTaskId,
        isChatNoteVisible,
        setIsChatNoteVisible,
        handleCreateNewChatNoteIfNotExist,
    } = props;
    const { mode } = useColorScheme();

    const isYou: boolean = myself.userId === thread.dmPartnerUser.userId;

    const dummyThreadChat: ThreadProps = {
        chatId: thread.chatId,
        chatName: thread.chatName,
        threadId: thread.threadId,
        chatType: thread.chatType,
        dmPartnerUser: thread.dmPartnerUser,
        taskId: thread.taskId,
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

            <Stack spacing={0.3} direction="row" sx={{ alignItems: "center" }}>
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
                                borderRadius: "5px",
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
                                        borderRadius: "5px",
                                    }}
                                >
                                    {currentPreviewTask.status.status || "N/A"}
                                </Chip>
                            </>
                        )}
                    </>
                )}

                {/* Custom header in DM/GM thread */}
                {thread.chatType !== 3 && thread.chatType !== 4 && currentPreviewTaskId === -1 && (
                    <>
                        <Tooltip title="New Task" size="sm">
                            <IconButton
                                component="a"
                                size="sm"
                                variant="plain"
                                color="neutral"
                                onClick={() => {
                                    setIsMainChatVisible(true);
                                    setIsThreadVisible(true);
                                    setIsTaskPreviewVisible(false);
                                    setIsCreatingTask({
                                        flag: true,
                                        parentTaskId: null,
                                        rootTaskId: null,
                                    });
                                }}
                                sx={{ px: "10px" }}
                            >
                                <PlaylistAddIcon />
                            </IconButton>
                        </Tooltip>
                    </>
                )}

                {!(
                    thread.chatType !== 3 &&
                    thread.chatType !== 4 &&
                    currentPreviewTaskId === -1
                ) && (
                    <Tooltip title="Open Task" size="sm">
                        <IconButton
                            size="sm"
                            onClick={() => {
                                setIsMainChatVisible(false);
                                setIsThreadVisible(true);
                                setIsTaskPreviewVisible(true);
                                setIsCreatingTask({
                                    flag: false,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                });
                                if (setIsOpeningTask) {
                                    setIsOpeningTask(true);
                                }
                            }}
                        >
                            <AssignmentRoundedIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip title="Open Note" size="sm">
                    <IconButton
                        component="a"
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => {
                            handleCreateNewChatNoteIfNotExist(
                                thread.chatType,
                                thread.chatId,
                                true,
                                thread.threadId
                            );
                            setIsChatNoteVisible(true);
                            setIsMainChatVisible(false);
                            setIsThreadVisible(true);
                            setIsTaskPreviewVisible(false);
                            setIsCreatingTask({ ...isCreatingTask, flag: false });
                            if (setIsOpeningTask) {
                                setIsOpeningTask(false);
                            }
                        }}
                    >
                        <NoteAltIcon />
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
