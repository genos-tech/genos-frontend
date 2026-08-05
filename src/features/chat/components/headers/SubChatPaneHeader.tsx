import { useMemo } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import { Badge, IconButton, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { useMarkAllChatActivityRead } from "../../hooks/useMarkAllChatActivityRead";
import { HeaderUserName } from "./HeaderUserName";

// Theme-aware styling - Indigo/Blue theme for chat
const ChatPaneHeaderStyles = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.95) 0%, rgba(20,22,34,0.98) 100%)",
        containerBorder: "rgba(var(--gp-brand-700-rgb), 0.15)",
        buttonBg:
            "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brandalt-500-rgb), 0.12) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.22) 0%, rgba(var(--gp-brandalt-500-rgb), 0.22) 100%)",
        buttonBorder: "rgba(var(--gp-brand-700-rgb), 0.3)",
        primaryButtonBg:
            "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
        primaryButtonHover:
            "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 100%)",
        dangerBg:
            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.12) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.12) 100%)",
        dangerHover:
            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.22) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.22) 100%)",
        dangerBorder: "rgba(var(--gp-tint-danger-rgb), 0.3)",
        accentColor: "var(--gp-brandalt-400)",
        glowColor: "rgba(var(--gp-brand-700-rgb), 0.25)",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(238,242,255,0.5) 100%)",
        containerBorder: "rgba(var(--gp-brand-700-rgb), 0.12)",
        buttonBg:
            "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.08) 0%, rgba(var(--gp-brandalt-500-rgb), 0.08) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.15) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)",
        buttonBorder: "rgba(var(--gp-brand-700-rgb), 0.2)",
        primaryButtonBg:
            "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
        primaryButtonHover:
            "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 100%)",
        dangerBg:
            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.08) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.08) 100%)",
        dangerHover:
            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.15) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.15) 100%)",
        dangerBorder: "rgba(var(--gp-tint-danger-rgb), 0.2)",
        accentColor: "var(--gp-brand-700)",
        glowColor: "rgba(var(--gp-brand-700-rgb), 0.15)",
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
    const { t } = useTranslation();
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
            boxShadow: "0 4px 12px rgba(var(--gp-tint-danger-rgb), 0.2)",
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

    // PUNCH LIST (v3 chatId migration): `subChat.chatId` is `string`
    // post-flip; `ActivityMessageProps.chatId` and the `markAllAsRead`
    // API are still `number`. Cast once; legacy `/` socket activity
    // events carry numeric chatIds, so the comparison is meaningful for
    // those rows. UUID-shaped v3 chatIds won't match the legacy activity
    // store, which is the right behavior — the v3 read-cursor path
    // handles its own state.
    const subChatIdLegacy = subChat ? (subChat.chatId as unknown as number) : undefined;

    const unreadActivityCount = useMemo(
        () =>
            subChat
                ? useCM.activityMessages.filter(
                      (a) =>
                          a.chatType === subChat.chatType &&
                          a.chatId === subChatIdLegacy &&
                          a.isRead === false
                  ).length
                : 0,
        [useCM.activityMessages, subChat?.chatType, subChatIdLegacy]
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
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Mark all activity in this chat as read */}
                {subChat && unreadActivityCount > 0 && (
                    <AppTooltip size="sm" title={t.chat.headers.markAllReadAria}>
                        <IconButton
                            aria-label={t.chat.headers.markAllReadAria}
                            size="sm"
                            sx={actionButtonStyle}
                            variant="plain"
                            onClick={() => markAllAsRead(subChat.chatType, subChatIdLegacy!)}
                        >
                            <DoneAllRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* Create Task Button */}
                {useCM.currentSubChat &&
                    (useCM.currentSubChat.chatType === 3 ||
                        useCM.currentSubChat.chatType === 4) && (
                        <AppTooltip size="sm" title={t.chat.headers.createNewTaskTooltip}>
                            <IconButton
                                size="sm"
                                sx={primaryButtonStyle}
                                variant="plain"
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
                        </AppTooltip>
                    )}

                {/* Swap Chat Button */}
                <AppTooltip size="sm" title={t.chat.headers.swapChats}>
                    <IconButton
                        size="sm"
                        sx={actionButtonStyle}
                        variant="plain"
                        onClick={() => swapChat()}
                    >
                        <SwapVertRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                    </IconButton>
                </AppTooltip>

                {/* To-Do Button (only for self chat) */}
                {isYou === true && (
                    <>
                        {isToDoVisible === true ? (
                            <AppTooltip size="sm" title={t.chat.headers.backToDM}>
                                <IconButton
                                    size="sm"
                                    sx={actionButtonStyle}
                                    variant="plain"
                                    onClick={() => setIsToDoVisible(false)}
                                >
                                    <QuestionAnswerRoundedIcon
                                        sx={{ fontSize: 18, color: styles.accentColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        ) : (
                            <AppTooltip size="sm" title={t.chat.headers.todoTooltip}>
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
                                        sx={actionButtonStyle}
                                        variant="plain"
                                        onClick={() => setIsToDoVisible(true)}
                                    >
                                        <ChecklistRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    </IconButton>
                                </Badge>
                            </AppTooltip>
                        )}
                    </>
                )}

                {/* Close Button */}
                <AppTooltip size="sm" title={t.chat.headers.close}>
                    <IconButton
                        size="sm"
                        sx={dangerButtonStyle}
                        variant="plain"
                        onClick={() => useCM.setIsSubChatVisible(false)}
                    >
                        <CloseRoundedIcon
                            sx={{ fontSize: 18, color: "var(--gp-tint-danger-alt)" }}
                        />
                    </IconButton>
                </AppTooltip>
            </Stack>
        </Stack>
    );
};
