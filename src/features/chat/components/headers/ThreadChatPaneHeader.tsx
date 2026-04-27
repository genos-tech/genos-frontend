import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";
import { useChatContext } from "../../context/ChatContext";

// Theme-aware styling - Purple/Violet theme for threads
const HEADER_STYLES = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.95) 0%, rgba(20,22,34,0.98) 100%)",
        containerBorder: "rgba(139,92,246,0.15)",
        buttonBg: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.12) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(168,85,247,0.22) 100%)",
        buttonBorder: "rgba(139,92,246,0.3)",
        primaryButtonBg: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
        primaryButtonHover: "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.12) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.22) 100%)",
        dangerBorder: "rgba(239,68,68,0.3)",
        chipBg: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(168,85,247,0.15) 100%)",
        chipBorder: "rgba(139,92,246,0.3)",
        threadBadgeBg: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
        accentColor: "#a78bfa",
        textColor: "#f1f5f9",
        glowColor: "rgba(139,92,246,0.25)",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,243,255,0.5) 100%)",
        containerBorder: "rgba(124,58,237,0.12)",
        buttonBg: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(168,85,247,0.08) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(168,85,247,0.15) 100%)",
        buttonBorder: "rgba(124,58,237,0.2)",
        primaryButtonBg: "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)",
        primaryButtonHover: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerBorder: "rgba(239,68,68,0.2)",
        chipBg: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(168,85,247,0.1) 100%)",
        chipBorder: "rgba(124,58,237,0.2)",
        threadBadgeBg: "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)",
        accentColor: "#7c3aed",
        textColor: "#1e293b",
        glowColor: "rgba(124,58,237,0.15)",
    },
};

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
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;
    const { currentThreadTaskId } = useChatContext();

    const isYou: boolean = myself.userId === useCM.currentThreadChat?.dmPartnerUser.userId && useCM.currentThreadChat?.chatType === 1;

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

    // Primary button style
    const primaryButtonStyle = {
        background: styles.primaryButtonBg,
        border: "none",
        borderRadius: "10px",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 2px 8px ${styles.glowColor}`,
        "&:hover": {
            background: styles.primaryButtonHover,
            transform: "translateY(-2px)",
            boxShadow: `0 6px 16px ${styles.glowColor}`,
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
                {/* Task ID and Status chips (for PM/task threads) */}
                {(((useCM.currentThreadChat?.chatType === 3 ||
                    useCM.currentThreadChat?.chatType === 4) &&
                    currentThreadTaskId !== -1) ||
                    (currentThreadTaskId !== -1 &&
                        useTM.currentPreviewTask &&
                        useCM.currentThreadChat?.taskExist === true)) && (
                    <>
                        <Chip
                            size="sm"
                            variant="soft"
                            sx={{
                                height: 28,
                                borderRadius: "8px",
                                background: styles.chipBg,
                                border: `1px solid ${styles.chipBorder}`,
                                fontWeight: 600,
                                fontSize: "12px",
                            }}
                        >
                            ID: {useCM.currentThreadChat?.taskId || "N/A"}
                        </Chip>

                        {useTM.currentPreviewTask && (
                            <Chip
                                size="sm"
                                sx={{
                                    height: 28,
                                    borderRadius: "8px",
                                    backgroundColor: useTM.currentPreviewTask.status.color
                                        ? alpha(
                                              useTM.currentPreviewTask.status.color,
                                              isDark ? 0.5 : 0.75
                                          )
                                        : "transparent",
                                    color: useTM.currentPreviewTask.status.textColor,
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    border: `1px solid ${
                                        useTM.currentPreviewTask.status.color
                                            ? alpha(useTM.currentPreviewTask.status.color, 0.4)
                                            : "transparent"
                                    }`,
                                }}
                            >
                                {useTM.currentPreviewTask.status.status || "N/A"}
                            </Chip>
                        )}
                    </>
                )}

                {/* Create Task Button (for threads without a task, excluding PM) */}
                {useCM.currentThreadChat?.chatType !== 3 &&
                    currentThreadTaskId === -1 && (
                        <Tooltip
                            size="sm"
                            title="Create a New Task"
                            variant="soft"
                            sx={{ borderRadius: "8px" }}
                        >
                            <IconButton
                                size="sm"
                                variant="plain"
                                sx={primaryButtonStyle}
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
                                <AddTaskRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                {/* Open Task Button (only when a task exists) */}
                {currentThreadTaskId !== -1 && (
                    <Tooltip
                        size="sm"
                        title="Open Task"
                        variant="soft"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => {
                                useCM.setIsMainChatVisible(false);
                                useCM.setIsThreadVisible(true);
                                useTM.setCurrentPreviewTaskId(currentThreadTaskId);
                                useTM.setIsTaskPreviewVisible(true);
                                useTM.setIsCreatingTask({
                                    flag: false,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                });
                            }}
                        >
                            <AssignmentRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Open Note Button */}
                <Tooltip size="sm" title="Open Note" variant="soft" sx={{ borderRadius: "8px" }}>
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
                            let chatName = matchedChat?.chatName
                                || useCM.currentMainChat?.chatName
                                || useCM.currentThreadChat?.chatName;
                            if (chatType === 4 && matchedChat?.mdmMembers && matchedChat.mdmMembers.length > 0) {
                                const MAX_DISPLAY = 3;
                                const names = matchedChat.mdmMembers.map((m) => m.userName);
                                chatName = names.length <= MAX_DISPLAY
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
