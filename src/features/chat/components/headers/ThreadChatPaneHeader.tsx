import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ThreadChatPaneHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { MuteToggleButton } from "../../../../services/notifications/MuteToggleButton";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";
import { useChatContext } from "../../context/ChatContext";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const { myself, useCM, useNM, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? ThreadChatPaneHeaderStyles.dark : ThreadChatPaneHeaderStyles.light;
    const { currentThreadTaskId } = useChatContext();

    const isYou: boolean =
        myself.userId === useCM.currentThreadChat?.dmPartnerUser.userId &&
        useCM.currentThreadChat?.chatType === 1;

    // Action button style
    const actionButtonStyle = {
        background: styles.buttonBg,
        border: `1px solid ${styles.buttonBorder}`,
        borderRadius: "10px",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.buttonHover,
            transform: "translateY(-1px)",
            boxShadow: `0 4px 12px ${styles.glowColor}`,
        },
    };

    // Danger button style
    const dangerButtonStyle = {
        background: styles.dangerBg,
        border: `1px solid ${styles.dangerBorder}`,
        borderRadius: "10px",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(239,68,68,0.2)",
        },
    };

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
                alignItems: "center",
                px: { xs: 1.5, md: 2 },
                background: styles.containerBg,
                backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${styles.containerBorder}`,
                minHeight: "64px",
            }}
        >
            {/* Left section: Thread badge + Avatar + Name */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                {/* Thread badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: "10px",
                        background: styles.threadBadgeBg,
                        boxShadow: `0 2px 8px ${styles.glowColor}`,
                        flexShrink: 0,
                    }}
                >
                    <ReplyRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
                    <Typography
                        level="body-sm"
                        sx={{ fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}
                    >
                        Thread
                    </Typography>
                </Box>

                {/* MDM Avatar */}
                {useCM.currentThreadChat?.chatType === 4 && (
                    <Box sx={{ flexShrink: 0 }}>
                        <MDMAvatar
                            members={
                                useCM.allChats.find(
                                    (c) =>
                                        c.chatId === useCM.currentThreadChat?.chatId &&
                                        c.chatType === 4
                                )?.mdmMembers
                            }
                            size="sm"
                        />
                    </Box>
                )}

                {/* Chat name */}
                {useCM.currentThreadChat?.chatType === 4 ? (
                    <Tooltip
                        title={
                            useCM.allChats
                                .find(
                                    (c) =>
                                        c.chatId === useCM.currentThreadChat?.chatId &&
                                        c.chatType === 4
                                )
                                ?.mdmMembers?.map((m) => m.userName)
                                .join(", ") || useCM.currentThreadChat?.chatName
                        }
                        placement="bottom"
                        arrow
                    >
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                color: styles.textColor,
                                letterSpacing: "-0.01em",
                                maxWidth: 200,
                                cursor: "default",
                            }}
                            noWrap
                        >
                            {useCM.currentThreadChat?.chatName}
                        </Typography>
                    </Tooltip>
                ) : (
                    <Typography
                        level="title-md"
                        sx={{
                            fontWeight: 600,
                            color: styles.textColor,
                            letterSpacing: "-0.01em",
                        }}
                        noWrap
                    >
                        {isYou
                            ? `${useCM.currentThreadChat?.chatName} (you)`
                            : useCM.currentThreadChat?.chatName}
                    </Typography>
                )}
            </Stack>

            {/* Right section: Task info + Actions */}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Per-chat mute toggle (mutes the parent chat, which also
                    silences thread replies and any task-comment activity
                    rooted in the same chat). */}
                {useCM.currentThreadChat && (
                    <MuteToggleButton
                        chatType={useCM.currentThreadChat.chatType}
                        chatId={useCM.currentThreadChat.chatId}
                        chatName={useCM.currentThreadChat.chatName}
                    />
                )}

                {/*
                    Unified Task pill — replaces the previously-isolated
                    Task ID chip, Status chip, Open Task button and Create
                    Task button which sat side-by-side and confused users
                    about what was clickable vs informational. Two
                    variants share the same rounded shape so "task" is
                    perceived as one cohesive control:
                      - "exists":  clickable; shows Task #<id> plus a
                                   colored status dot/label when status
                                   info is trustworthy (chip-visibility
                                   rule preserved from the original).
                                   The whole pill is the "open task"
                                   affordance.
                      - "create":  primary-styled; shows + Create Task
                                   label. Suppressed for PM threads
                                   (chatType === 3) which always have a
                                   task tied to the thread.
                */}
                {(() => {
                    const hasTask = currentThreadTaskId !== -1;
                    const chatType = useCM.currentThreadChat?.chatType;

                    if (hasTask) {
                        // Original chip-visibility rule: only show status
                        // info when we trust it — PM/MDM threads always
                        // have a real task; other types only after the
                        // preview is loaded with taskExist === true.
                        const showStatus =
                            chatType === 3 ||
                            chatType === 4 ||
                            (!!useTM.currentPreviewTask &&
                                useCM.currentThreadChat?.taskExist === true);
                        const status = useTM.currentPreviewTask?.status;
                        const statusColor = status?.color || styles.accentColor;

                        return (
                            <Tooltip
                                size="sm"
                                title="Open Task"
                                variant="soft"
                                sx={{ borderRadius: "8px" }}
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={`Open Task #${useCM.currentThreadChat?.taskId ?? "N/A"}`}
                                    onClick={() => {
                                        useCM.setIsMainChatVisible(false);
                                        useCM.setIsThreadVisible(true);
                                        useTM.setCurrentPreviewTaskId(currentThreadTaskId);
                                        useTM.setIsTaskPreviewVisible(true);
                                        useTM.setIsCreatingTask({
                                            flag: false,
                                            parentTaskId: null,
                                            rootTaskId: null,
                                            creationKind: "task",
                                            milestoneId: null,
                                        });
                                    }}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.75,
                                        height: 32,
                                        px: 1.25,
                                        borderRadius: "10px",
                                        border: `1px solid ${styles.chipBorder}`,
                                        background: styles.chipBg,
                                        cursor: "pointer",
                                        font: "inherit",
                                        color: styles.textColor,
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                            boxShadow: `0 4px 12px ${styles.glowColor}`,
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${styles.accentColor}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    <AssignmentRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: styles.accentColor,
                                        }}
                                    />
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontWeight: 700,
                                            color: styles.textColor,
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        Task #{useCM.currentThreadChat?.taskId ?? "N/A"}
                                    </Typography>

                                    {showStatus && status && (
                                        <>
                                            <Box
                                                sx={{
                                                    width: "1px",
                                                    height: 14,
                                                    bgcolor: styles.chipBorder,
                                                    mx: 0.25,
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    px: 0.75,
                                                    py: 0.125,
                                                    borderRadius: "6px",
                                                    background: status.color
                                                        ? alpha(status.color, isDark ? 0.4 : 0.6)
                                                        : "transparent",
                                                    color: status.textColor,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: statusColor,
                                                        boxShadow: `0 0 0 2px ${alpha(
                                                            statusColor,
                                                            isDark ? 0.25 : 0.18
                                                        )}`,
                                                    }}
                                                />
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: "inherit",
                                                        fontSize: "11px",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.04em",
                                                    }}
                                                >
                                                    {status.status || "N/A"}
                                                </Typography>
                                            </Box>
                                        </>
                                    )}
                                </Box>
                            </Tooltip>
                        );
                    }

                    // No task yet → show Create Task pill (suppressed for
                    // PM threads, which always have a task by design).
                    if (chatType === 3) return null;

                    return (
                        <Tooltip
                            size="sm"
                            title="New task linked to this thread"
                            variant="soft"
                            sx={{ borderRadius: "8px" }}
                        >
                            <Box
                                component="button"
                                type="button"
                                aria-label="Create a new task linked to this thread"
                                onClick={() => {
                                    useCM.setIsMainChatVisible(true);
                                    useCM.setIsThreadVisible(true);
                                    useTM.setIsTaskPreviewVisible(false);
                                    useTM.setIsCreatingTask({
                                        flag: true,
                                        parentTaskId: null,
                                        rootTaskId: null,
                                        creationKind: "task",
                                        milestoneId: null,
                                    });
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    height: 32,
                                    px: 1.5,
                                    borderRadius: "10px",
                                    border: "none",
                                    background: styles.primaryButtonBg,
                                    cursor: "pointer",
                                    font: "inherit",
                                    color: "#fff",
                                    boxShadow: `0 2px 8px ${styles.glowColor}`,
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background: styles.primaryButtonHover,
                                        transform: "translateY(-2px)",
                                        boxShadow: `0 6px 16px ${styles.glowColor}`,
                                    },
                                    "&:focus-visible": {
                                        outline: `2px solid ${styles.accentColor}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                <AddTaskRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontWeight: 700,
                                        color: "#fff",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    Create Task
                                </Typography>
                            </Box>
                        </Tooltip>
                    );
                })()}

                {/* Open Note Button, invisible in PM threads */}
                {useCM.currentThreadChat?.chatType !== 3 && (
                    <Tooltip
                        size="sm"
                        title="Open Note linked to this thread"
                        variant="soft"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => {
                                const chatType = useCM.currentThreadChat?.chatType;
                                const chatId = useCM.currentThreadChat?.chatId;
                                useNM.setTabItems(
                                    useNM.tabItems.filter(
                                        (item: any) =>
                                            item.noteType === 3 &&
                                            item.chatType === chatType &&
                                            item.chatId === chatId
                                    )
                                );
                                const matchedChat = useCM.allChats.find(
                                    (c) => c.chatId === chatId && c.chatType === chatType
                                );
                                let chatName =
                                    matchedChat?.chatName ||
                                    useCM.currentMainChat?.chatName ||
                                    useCM.currentThreadChat?.chatName;
                                if (
                                    chatType === 4 &&
                                    matchedChat?.mdmMembers &&
                                    matchedChat.mdmMembers.length > 0
                                ) {
                                    const MAX_DISPLAY = 3;
                                    const names = matchedChat.mdmMembers.map((m) => m.userName);
                                    chatName =
                                        names.length <= MAX_DISPLAY
                                            ? names.join(", ")
                                            : `${names.slice(0, MAX_DISPLAY).join(", ")} +${names.length - MAX_DISPLAY}`;
                                }
                                useNM.handleCreateNewChatNoteIfNotExist(
                                    chatType as number,
                                    chatId as number,
                                    true,
                                    useCM.currentThreadChat?.threadId as number,
                                    chatName
                                );
                                useCM.setIsChatNoteVisibleInChat(true);
                                useCM.setIsMainChatVisible(false);
                                useCM.setIsThreadVisible(true);
                                useTM.setIsTaskPreviewVisible(false);
                                useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
                            }}
                        >
                            <NoteAltRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Close Button */}
                <Tooltip size="sm" title="Close" variant="soft" sx={{ borderRadius: "8px" }}>
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={() => {
                            useCM.setIsMainChatVisible(true);
                            useCM.setIsThreadVisible(false);
                            useCM.setCurrentThreadChat(dummyThreadChat);
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
};
