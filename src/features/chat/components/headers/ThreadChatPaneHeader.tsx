import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import ReplyIcon from "@mui/icons-material/Reply";
import { Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    CM: ChatManagementState;
    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    TM: TaskManagementState;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const { myself, CM, handleCreateNewChatNoteIfNotExist, TM } = props;
    const { mode } = useColorScheme();

    const isYou: boolean = myself.userId === CM.currentThreadChat?.dmPartnerUser.userId;

    const dummyThreadChat: ThreadProps = {
        chatId: CM.currentThreadChat?.chatId as number,
        chatName: CM.currentThreadChat?.chatName as string,
        threadId: CM.currentThreadChat?.threadId as number,
        chatType: CM.currentThreadChat?.chatType as number,
        dmPartnerUser: CM.currentThreadChat?.dmPartnerUser as UserProps,
        taskId: CM.currentThreadChat?.taskId as number | null,
        messages: [],
        TSLastMessage: CM.currentThreadChat?.TSLastMessage as string,
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
                        {isYou
                            ? `${CM.currentThreadChat?.chatName} (you)`
                            : CM.currentThreadChat?.chatName}
                    </Typography>
                </div>
            </Stack>

            <Stack direction="row" spacing={0.3} sx={{ alignItems: "center" }}>
                {/* Custom header in PM and DM/GM (having a task) thread */}
                {(((CM.currentThreadChat?.chatType === 3 ||
                    CM.currentThreadChat?.chatType === 4) &&
                    TM.currentPreviewTaskId !== -1) ||
                    (TM.currentPreviewTaskId !== -1 &&
                        TM.currentPreviewTask &&
                        CM.currentThreadChat?.taskExist === true)) && (
                    <>
                        <Chip
                            key={CM.currentThreadChat?.taskId}
                            color="neutral"
                            size="sm"
                            variant="soft"
                            sx={{
                                borderRadius: "5px",
                                fontWeight: "bold",
                            }}
                        >
                            ID: {CM.currentThreadChat?.taskId || "N/A"}
                        </Chip>
                        {TM.currentPreviewTask && (
                            <>
                                <Chip
                                    size="sm"
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
                {CM.currentThreadChat?.chatType !== 3 &&
                    CM.currentThreadChat?.chatType !== 4 &&
                    TM.currentPreviewTaskId === -1 && (
                        <>
                            <Tooltip size="sm" title="Create a New Task" variant="outlined">
                                <IconButton
                                    color="neutral"
                                    component="a"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => {
                                        CM.setIsMainChatVisible(true);
                                        CM.setIsThreadVisible(true);
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
                    CM.currentThreadChat?.chatType !== 3 &&
                    CM.currentThreadChat?.chatType !== 4 &&
                    TM.currentPreviewTaskId === -1
                ) && (
                    <Tooltip size="sm" title="Open Task" variant="outlined">
                        <IconButton
                            size="sm"
                            onClick={() => {
                                CM.setIsMainChatVisible(false);
                                CM.setIsThreadVisible(true);
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

                <Tooltip size="sm" title="Open Note" variant="outlined">
                    <IconButton
                        color="neutral"
                        component="a"
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            handleCreateNewChatNoteIfNotExist(
                                CM.currentThreadChat?.chatType as number,
                                CM.currentThreadChat?.chatId as number,
                                true,
                                CM.currentThreadChat?.threadId as number
                            );
                            CM.setIsChatNoteVisibleInChat(true);
                            CM.setIsMainChatVisible(false);
                            CM.setIsThreadVisible(true);
                            TM.setIsTaskPreviewVisible(false);
                            TM.setIsCreatingTask({ ...TM.isCreatingTask, flag: false });
                        }}
                    >
                        <NoteAltIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip size="sm" title="Close" variant="outlined">
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            CM.setIsMainChatVisible(true);
                            CM.setIsThreadVisible(false);
                            CM.setCurrentThreadChat(dummyThreadChat);
                        }}
                    >
                        <CancelIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
};
