import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import ReplyIcon from "@mui/icons-material/Reply";
import { Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsMainChatVisible: (chat: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    isChatNoteVisibleInChat: boolean;
    setIsChatNoteVisibleInChat: (value: boolean) => void;
    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    TM: TaskManagementState;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const {
        myself,
        thread,
        setCurrentThreadChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        isChatNoteVisibleInChat,
        setIsChatNoteVisibleInChat,
        handleCreateNewChatNoteIfNotExist,
        TM,
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
                    color="neutral"
                    size="lg"
                    startDecorator={<ReplyIcon />}
                    sx={{ borderRadius: "4px" }}
                    variant="solid"
                >
                    Thread
                </Chip>

                <div>
                    <Typography
                        component="h2"
                        sx={{ fontWeight: "lg", fontSize: "lg", pl: "5px" }}
                        noWrap
                    >
                        {isYou ? `${thread?.chatName} (you)` : thread?.chatName}
                    </Typography>
                </div>
            </Stack>

            <Stack direction="row" spacing={0.3} sx={{ alignItems: "center" }}>
                {/* Custom header in PM and DM/GM (having a task) thread */}
                {(((thread.chatType === 3 || thread.chatType === 4) &&
                    TM.currentPreviewTaskId !== -1) ||
                    (TM.isTaskPreviewVisible === false &&
                        TM.currentPreviewTaskId !== -1 &&
                        TM.currentPreviewTask &&
                        thread.taskExist === true)) && (
                    <>
                        <Chip
                            key={thread.taskId}
                            color="neutral"
                            size="lg"
                            variant="soft"
                            sx={{
                                borderRadius: "5px",
                                fontWeight: "bold",
                            }}
                        >
                            ID: {thread.taskId || "N/A"}
                        </Chip>
                        {TM.currentPreviewTask && (
                            <>
                                <Chip
                                    size="lg"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: TM.currentPreviewTask.status.color
                                            ? alpha(
                                                  TM.currentPreviewTask.status.color,
                                                  mode === "dark" ? 0.5 : 0.75
                                              )
                                            : "transparent",
                                        color: TM.currentPreviewTask.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
                                    }}
                                >
                                    {TM.currentPreviewTask.status.status || "N/A"}
                                </Chip>
                            </>
                        )}
                    </>
                )}

                {/* Custom header in DM/GM thread */}
                {thread.chatType !== 3 &&
                    thread.chatType !== 4 &&
                    TM.currentPreviewTaskId === -1 && (
                        <>
                            <Tooltip size="sm" title="New Task">
                                <IconButton
                                    color="neutral"
                                    component="a"
                                    size="sm"
                                    sx={{ px: "10px" }}
                                    variant="plain"
                                    onClick={() => {
                                        setIsMainChatVisible(true);
                                        setIsThreadVisible(true);
                                        TM.setIsTaskPreviewVisible(false);
                                        TM.setIsCreatingTask({
                                            flag: true,
                                            parentTaskId: null,
                                            rootTaskId: null,
                                        });
                                    }}
                                >
                                    <PlaylistAddIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}

                {!(
                    thread.chatType !== 3 &&
                    thread.chatType !== 4 &&
                    TM.currentPreviewTaskId === -1
                ) && (
                    <Tooltip size="sm" title="Open Task">
                        <IconButton
                            size="sm"
                            onClick={() => {
                                setIsMainChatVisible(false);
                                setIsThreadVisible(true);
                                TM.setIsTaskPreviewVisible(true);
                                TM.setIsCreatingTask({
                                    flag: false,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                });
                            }}
                        >
                            <AssignmentRoundedIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip size="sm" title="Open Note">
                    <IconButton
                        color="neutral"
                        component="a"
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            handleCreateNewChatNoteIfNotExist(
                                thread.chatType,
                                thread.chatId,
                                true,
                                thread.threadId
                            );
                            setIsChatNoteVisibleInChat(true);
                            setIsMainChatVisible(false);
                            setIsThreadVisible(true);
                            TM.setIsTaskPreviewVisible(false);
                            TM.setIsCreatingTask({ ...TM.isCreatingTask, flag: false });
                        }}
                    >
                        <NoteAltIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip size="sm" title="Close">
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
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
