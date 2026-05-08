import { useMemo } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import { Badge, IconButton, Stack, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { useMarkAllChatActivityRead } from "../../hooks/useMarkAllChatActivityRead";
import { HeaderUserName } from "./HeaderUserName";

// Theme-aware styling - Indigo/Blue theme for chat
const ChatPaneHeaderStyles = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.95) 0%, rgba(20,22,34,0.98) 100%)",
        containerBorder: "rgba(99,102,241,0.15)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.22) 100%)",
        buttonBorder: "rgba(99,102,241,0.3)",
        primaryButtonBg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        primaryButtonHover: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.12) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.22) 100%)",
        dangerBorder: "rgba(239,68,68,0.3)",
        accentColor: "#818cf8",
        glowColor: "rgba(99,102,241,0.25)",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(238,242,255,0.5) 100%)",
        containerBorder: "rgba(79,70,229,0.12)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        buttonBorder: "rgba(79,70,229,0.2)",
        primaryButtonBg: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
        primaryButtonHover: "linear-gradient(135deg, #818cf8 0%, #8b5cf6 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerBorder: "rgba(239,68,68,0.2)",
        accentColor: "#6366f1",
        glowColor: "rgba(99,102,241,0.15)",
    },
};

type SubChatPaneHeaderProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    incompleteTodoCount: number;
    useTM: TaskManagementState;
};

export const SubChatPaneHeader = (props: SubChatPaneHeaderProps) => {
    const {
        incompleteTodoCount,
        isToDoVisible,
        myself,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useCM,
        useTM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? ChatPaneHeaderStyles.dark : ChatPaneHeaderStyles.light;

    const isYou: boolean = myself.userId === useCM.currentSubChat?.dmPartnerUser.userId;

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

    const swapChat = () => {
        if (useCM.currentMainChat && useCM.currentSubChat) {
            useCM.setCurrentMainChat(useCM.currentSubChat);
            useCM.setCurrentSubChat(useCM.currentMainChat);
        }
    };

    const subChat = useCM.currentSubChat;
    const { markAllAsRead } = useMarkAllChatActivityRead({ myself, useCM });

    const unreadActivityCount = useMemo(
        () =>
            subChat
                ? useCM.activityMessages.filter(
                      (a) =>
                          a.chatType === subChat.chatType &&
                          a.chatId === subChat.chatId &&
                          a.isRead === false
                  ).length
                : 0,
        [useCM.activityMessages, subChat?.chatType, subChat?.chatId]
    );

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
            <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ alignItems: "center" }}>
                <HeaderUserName
                    chat={useCM.currentSubChat}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Mark all activity in this chat as read */}
                {subChat && unreadActivityCount > 0 && (
                    <Tooltip
                        size="sm"
                        title={`Mark all in this chat as read`}
                        variant="outlined"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => markAllAsRead(subChat.chatType, subChat.chatId)}
                            aria-label="Mark all in this chat as read"
                        >
                            <DoneAllRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Create Task Button */}
                {useCM.currentSubChat &&
                    (useCM.currentSubChat.chatType === 3 ||
                        useCM.currentSubChat.chatType === 4) && (
                        <Tooltip
                            size="sm"
                            title="Create a new task"
                            variant="outlined"
                            sx={{ borderRadius: "8px" }}
                        >
                            <IconButton
                                size="sm"
                                variant="plain"
                                sx={primaryButtonStyle}
                                onClick={() => {
                                    useCM.setIsMainChatVisible(true);
                                    useCM.setIsThreadVisible(false);
                                    useTM.setIsTaskPreviewVisible(false);
                                    useTM.setIsCreatingTask({
                                        flag: true,
                                        parentTaskId: null,
                                        rootTaskId: null,
                                        creationKind: "task",
                                        milestoneId: null,
                                    });
                                }}
                            >
                                <AddTaskRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                {/* Swap Chat Button */}
                <Tooltip
                    size="sm"
                    title="Swap chats"
                    variant="outlined"
                    sx={{ borderRadius: "8px" }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={actionButtonStyle}
                        onClick={() => swapChat()}
                    >
                        <SwapVertRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                    </IconButton>
                </Tooltip>

                {/* To-Do Button (only for self chat) */}
                {isYou === true && (
                    <>
                        {isToDoVisible === true ? (
                            <Tooltip
                                size="sm"
                                title="Back to DM"
                                variant="outlined"
                                sx={{ borderRadius: "8px" }}
                            >
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    sx={actionButtonStyle}
                                    onClick={() => setIsToDoVisible(false)}
                                >
                                    <QuestionAnswerRoundedIcon
                                        sx={{ fontSize: 18, color: styles.accentColor }}
                                    />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Tooltip
                                size="sm"
                                title="To-Do"
                                variant="outlined"
                                sx={{ borderRadius: "8px" }}
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={incompleteTodoCount}
                                    color="primary"
                                    size="sm"
                                    sx={{
                                        "& .MuiBadge-badge": {
                                            zIndex: 1,
                                            background: styles.primaryButtonBg,
                                            border: "2px solid",
                                            borderColor: isDark ? "#1e2028" : "#fff",
                                        },
                                    }}
                                >
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        sx={actionButtonStyle}
                                        onClick={() => setIsToDoVisible(true)}
                                    >
                                        <ChecklistRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                    </>
                )}

                {/* Close Button */}
                <Tooltip size="sm" title="Close" variant="outlined" sx={{ borderRadius: "8px" }}>
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={() => useCM.setIsSubChatVisible(false)}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
};
