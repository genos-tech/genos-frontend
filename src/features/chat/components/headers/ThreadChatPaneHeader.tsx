import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import ReplyIcon from "@mui/icons-material/Reply";
import { Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const { myself, useCM, useNM, useTM } = props;
    const { mode } = useColorScheme();

    const isYou: boolean = myself.userId === useCM.currentThreadChat?.dmPartnerUser.userId;

    const dummyThreadChat: ThreadProps = {
        chatId: useCM.currentThreadChat?.chatId as number,
        chatName: useCM.currentThreadChat?.chatName as string,
        threadId: useCM.currentThreadChat?.threadId as number,
        chatType: useCM.currentThreadChat?.chatType as number,
        dmPartnerUser: useCM.currentThreadChat?.dmPartnerUser as UserProps,
        taskId: useCM.currentThreadChat?.taskId as number | null,
        messages: [],
        TSLastMessage: useCM.currentThreadChat?.TSLastMessage as string,
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
                            ? `${useCM.currentThreadChat?.chatName} (you)`
                            : useCM.currentThreadChat?.chatName}
                    </Typography>
                </div>
            </Stack>

            <Stack direction="row" spacing={0.3} sx={{ alignItems: "center" }}>
                {/* Custom header in PM and DM/GM (having a task) thread */}
                {(((useCM.currentThreadChat?.chatType === 3 ||
                    useCM.currentThreadChat?.chatType === 4) &&
                    useTM.currentPreviewTaskId !== -1) ||
                    (useTM.currentPreviewTaskId !== -1 &&
                        useTM.currentPreviewTask &&
                        useCM.currentThreadChat?.taskExist === true)) && (
                    <>
                        <Chip
                            key={useCM.currentThreadChat?.taskId}
                            color="neutral"
                            size="sm"
                            variant="soft"
                            sx={{
                                borderRadius: "5px",
                                fontWeight: "bold",
                            }}
                        >
                            ID: {useCM.currentThreadChat?.taskId || "N/A"}
                        </Chip>
                        {useTM.currentPreviewTask && (
                            <>
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: useTM.currentPreviewTask.status.color
                                            ? alpha(
                                                  useTM.currentPreviewTask.status.color,
                                                  mode === "dark" ? 0.5 : 0.75
                                              )
                                            : "transparent",
                                        color: useTM.currentPreviewTask.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
                                    }}
                                >
                                    {useTM.currentPreviewTask.status.status || "N/A"}
                                </Chip>
                            </>
                        )}
                    </>
                )}

                {/* Custom header in DM/GM thread */}
                {useCM.currentThreadChat?.chatType !== 3 &&
                    useCM.currentThreadChat?.chatType !== 4 &&
                    useTM.currentPreviewTaskId === -1 && (
                        <>
                            <Tooltip size="sm" title="Create a New Task" variant="outlined">
                                <IconButton
                                    color="neutral"
                                    component="a"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => {
                                        useCM.setIsMainChatVisible(true);
                                        useCM.setIsThreadVisible(true);
                                        useTM.setIsTaskPreviewVisible(false);
                                        useTM.setIsCreatingTask({
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
                    useCM.currentThreadChat?.chatType !== 3 &&
                    useCM.currentThreadChat?.chatType !== 4 &&
                    useTM.currentPreviewTaskId === -1
                ) && (
                    <Tooltip size="sm" title="Open Task" variant="outlined">
                        <IconButton
                            size="sm"
                            onClick={() => {
                                useCM.setIsMainChatVisible(false);
                                useCM.setIsThreadVisible(true);
                                useTM.setIsTaskPreviewVisible(true);
                                useTM.setIsCreatingTask({
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
                            useNM.handleCreateNewChatNoteIfNotExist(
                                useCM.currentThreadChat?.chatType as number,
                                useCM.currentThreadChat?.chatId as number,
                                true,
                                useCM.currentThreadChat?.threadId as number
                            );
                            useCM.setIsChatNoteVisibleInChat(true);
                            useCM.setIsMainChatVisible(false);
                            useCM.setIsThreadVisible(true);
                            useTM.setIsTaskPreviewVisible(false);
                            useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
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
                            useCM.setIsMainChatVisible(true);
                            useCM.setIsThreadVisible(false);
                            useCM.setCurrentThreadChat(dummyThreadChat);
                        }}
                    >
                        <CancelIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
};
