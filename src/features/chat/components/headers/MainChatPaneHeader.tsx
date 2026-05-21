import { useMemo, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Badge, Button, CircularProgress, IconButton, Snackbar, Stack, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatPaneHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { MuteToggleButton } from "../../../../services/notifications/MuteToggleButton";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { createEvent, deleteEvent, getEvent } from "../../../integrations/services/calendar";
import { useMarkAllChatActivityRead } from "../../hooks/useMarkAllChatActivityRead";
import { sendTextMessage } from "../../services/sendTextMessage";
import { ModalAddMembers } from "../modals/ModalAddMembers";
import { HeaderUserName } from "./HeaderUserName";

type MainChatPaneHeaderProps = {
    chat: ChatProps;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
    myself: UserProps;
    setIsToDoVisible: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const MainChatPaneHeader = (props: MainChatPaneHeaderProps) => {
    const {
        chat,
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

    const isYou: boolean = myself.userId === chat.dmPartnerUser.userId;

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
            boxShadow: "0 4px 12px rgba(232,121,195,0.2)",
        },
    };

    const [openAddMembers, setOpenAddMembers] = useState(false);

    // Quick Meet flow state. `lastQuickMeetEventId` carries the Google
    // event id created by the most recent click so the snackbar's Undo
    // can delete it on the user's behalf. Cleared on snackbar dismiss.
    const { accessToken } = useAuth();
    const [quickMeetLoading, setQuickMeetLoading] = useState(false);
    const [quickMeetSnackbar, setQuickMeetSnackbar] = useState<{
        kind: "success" | "error" | "info";
        text: string;
    } | null>(null);
    const [lastQuickMeetEventId, setLastQuickMeetEventId] = useState<string | null>(null);

    const handleQuickMeet = async () => {
        if (!accessToken || quickMeetLoading) return;
        setQuickMeetLoading(true);
        setQuickMeetSnackbar(null);

        const now = new Date();
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
        const event = await createEvent(
            accessToken,
            {
                add_meet: true,
                end: { dateTime: inOneHour.toISOString() },
                start: { dateTime: now.toISOString() },
                summary: t.chat.headers.quickMeetEventTitle,
            },
            (err) => {
                setQuickMeetSnackbar({
                    kind: "error",
                    text:
                        err === "Google account is not connected."
                            ? t.chat.headers.quickMeetNotConnected
                            : err || t.chat.headers.quickMeetFailed,
                });
            }
        );
        if (!event) {
            setQuickMeetLoading(false);
            return;
        }

        // hangoutLink may not be present on the create response;
        // conferenceData.createRequest.status.statusCode can be
        // "pending". Poll up to ~5 s for the link to appear before
        // giving up. Cheap; Google usually populates in <1 s.
        let link = event.hangoutLink;
        for (let i = 0; !link && i < 5; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const refreshed = await getEvent(accessToken, event.id);
            if (refreshed && typeof refreshed === "object" && "hangoutLink" in refreshed) {
                link = refreshed.hangoutLink;
            }
        }
        setQuickMeetLoading(false);

        if (!link) {
            setQuickMeetSnackbar({ kind: "error", text: t.chat.headers.quickMeetFailed });
            return;
        }

        sendTextMessage(socket, chat, link);
        setLastQuickMeetEventId(event.id);
        setQuickMeetSnackbar({ kind: "success", text: t.chat.headers.quickMeetSuccess });
    };

    const handleQuickMeetUndo = async () => {
        const id = lastQuickMeetEventId;
        setQuickMeetSnackbar(null);
        setLastQuickMeetEventId(null);
        if (!id || !accessToken) return;
        await deleteEvent(accessToken, id);
        setQuickMeetSnackbar({ kind: "info", text: t.chat.headers.quickMeetUndone });
    };

    const { markAllAsRead } = useMarkAllChatActivityRead({ myself, useCM });

    const unreadActivityCount = useMemo(
        () =>
            useCM.activityMessages.filter(
                (a) =>
                    a.chatType === chat.chatType && a.chatId === chat.chatId && a.isRead === false
            ).length,
        [useCM.activityMessages, chat.chatType, chat.chatId]
    );

    const switchSubToMain = () => {
        if (useCM.isSubChatVisible === true) {
            useCM.setCurrentMainChat(useCM.currentSubChat as ChatProps);
            useCM.setIsSubChatVisible(false);
        } else {
            useCM.setIsMainChatVisible(false);
        }
    };

    const swapChat = () => {
        useCM.setCurrentMainChat(useCM.currentSubChat as ChatProps);
        useCM.setCurrentSubChat(chat);
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
            <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ alignItems: "center" }}>
                <HeaderUserName
                    chat={chat}
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
                {/* Per-chat mute toggle */}
                <MuteToggleButton
                    chatType={chat.chatType}
                    chatId={chat.chatId}
                    chatName={chat.chatName}
                />

                {/* Mark all activity in this chat as read */}
                {unreadActivityCount > 0 && (
                    <Tooltip
                        size="sm"
                        title={t.chat.headers.markAllReadAria}
                        variant="outlined"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => markAllAsRead(chat.chatType, chat.chatId)}
                            aria-label={t.chat.headers.markAllReadAria}
                        >
                            <DoneAllRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Quick Meet — instant Meet link, posted to current chat */}
                <Tooltip
                    size="sm"
                    title={t.chat.headers.quickMeetTooltip}
                    variant="outlined"
                    sx={{ borderRadius: "8px" }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        disabled={quickMeetLoading}
                        sx={actionButtonStyle}
                        onClick={handleQuickMeet}
                        aria-label={t.chat.headers.quickMeetTooltip}
                    >
                        {quickMeetLoading ? (
                            <CircularProgress
                                size="sm"
                                sx={{ "--CircularProgress-size": "18px" }}
                            />
                        ) : (
                            <VideoCameraFrontRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        )}
                    </IconButton>
                </Tooltip>

                {/* Create Task Button */}
                {chat.chatType === 3 && (
                    <Tooltip
                        size="sm"
                        title={t.chat.headers.createNewTaskTooltip}
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

                {/* To-Do Button (only for self chat) */}
                {isYou === true && (
                    <>
                        {isToDoVisible === true ? (
                            <Tooltip
                                size="sm"
                                title={t.chat.headers.backToChat}
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
                                title={t.chat.headers.todoTooltip}
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

                {/* Swap Chat Button */}
                {useCM.isSubChatVisible && (
                    <Tooltip
                        size="sm"
                        title={t.chat.headers.swapChats}
                        variant="outlined"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => swapChat()}
                        >
                            <SwapVertRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Add Members Button (MDM / DM) */}
                {(chat.chatType === 4 || chat.chatType === 1) && (
                    <Tooltip
                        size="sm"
                        title={t.chat.headers.addMembers}
                        variant="outlined"
                        sx={{ borderRadius: "8px" }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
                            onClick={() => setOpenAddMembers(true)}
                        >
                            <PersonAddRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Close Button */}
                <Tooltip
                    size="sm"
                    title={t.chat.headers.close}
                    variant="outlined"
                    sx={{ borderRadius: "8px" }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={() => switchSubToMain()}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18, color: "#c026a8" }} />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* Add Members Modal */}
            {(chat.chatType === 4 || chat.chatType === 1) && (
                <ModalAddMembers
                    socket={socket}
                    myself={myself}
                    chat={chat as unknown as AllChatProps}
                    open={openAddMembers}
                    setOpen={setOpenAddMembers}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    setMyself={setMyself}
                />
            )}

            {/* Quick Meet feedback snackbar — surfaces transparently
                that a 1h calendar event was created, and offers Undo
                (deletes the event but leaves the posted chat message
                in place). */}
            <Snackbar
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                autoHideDuration={quickMeetSnackbar?.kind === "success" ? 8000 : 4000}
                color={
                    quickMeetSnackbar?.kind === "error"
                        ? "danger"
                        : quickMeetSnackbar?.kind === "success"
                          ? "success"
                          : "neutral"
                }
                open={quickMeetSnackbar !== null}
                variant="soft"
                endDecorator={
                    quickMeetSnackbar?.kind === "success" && lastQuickMeetEventId ? (
                        <Button size="sm" variant="outlined" onClick={handleQuickMeetUndo}>
                            {t.chat.headers.quickMeetUndo}
                        </Button>
                    ) : null
                }
                onClose={(_e, reason) => {
                    if (reason === "clickaway") return;
                    setQuickMeetSnackbar(null);
                    setLastQuickMeetEventId(null);
                }}
            >
                {quickMeetSnackbar?.text}
            </Snackbar>
        </Stack>
    );
};
