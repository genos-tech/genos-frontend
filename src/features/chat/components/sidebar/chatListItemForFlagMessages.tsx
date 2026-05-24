import * as React from "react";
import { useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FlagIcon from "@mui/icons-material/Flag";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import {
    Avatar,
    Box,
    Chip,
    IconButton,
    ListDivider,
    ListItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { FlaggedService } from "../../../../db/services/flagged.service";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { toggleMessagesPane } from "../../../../utils/sidebarUtils";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { addMessage } from "../../services/addMessage";
import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../../services/popSpecificMessages";
import { updateFlagMessage } from "../../services/updateFlagMessage";

// chat_type=4 carries two semantics in the wider codebase: legacy task
// comments (live in the PM store, chat_id = project_id) and the newer MDM
// chats (live in the MDM store, chat_id = mdm_id). The flag UI only exists
// inside chat bubbles (DM/GM/PM/MDM) — there is no "flag" affordance on a
// task comment — so every chat_type=4 flagged message we render here is an
// MDM message. The constant + label are named accordingly.
const CHAT_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    MDM: 4,
} as const;

const CHAT_TYPE_LABELS = {
    [CHAT_TYPES.DM]: "DM",
    [CHAT_TYPES.GM]: "GM",
    [CHAT_TYPES.PM]: "PM",
    [CHAT_TYPES.MDM]: "MDM",
} as const;

// Flagged message color scheme for visual distinction
const FLAGGED_COLOR_SCHEME = {
    dark: "#f87171",
    light: "#ef4444",
} as const;

type ChatListItemForFlagMessagesProps = ListItemButtonProps & {
    flaggedMessage: FlaggedMessageProps;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (value: string) => void;
    setCurrentProject: (value: ProjectProps) => void;
    useTM: TaskManagementState;
};

// Helper functions
const findChatForFlag = (
    allChats: AllChatProps[],
    flaggedMessage: FlaggedMessageProps
): AllChatProps | undefined =>
    allChats.find(
        (chat) =>
            chat.chatType === flaggedMessage.chatType && chat.chatId === flaggedMessage.chatId
    );

/**
 * Build the ChatProps that the chat pane consumes. Returns `null` when the
 * underlying chat has been deleted (no longer in `allChats`) or when the
 * loaded message slice is empty — the caller is expected to surface a
 * graceful "removed" state instead of trying to navigate.
 */
const createChatFromMessages = (
    messages: MessageProps[],
    moveToSpecificIndex: string,
    flaggedMessage: FlaggedMessageProps,
    allChats: AllChatProps[]
): ChatProps | null => {
    const currentChat = findChatForFlag(allChats, flaggedMessage);
    if (!currentChat || messages.length === 0) return null;

    return {
        chatId: flaggedMessage.chatId,
        chatName: flaggedMessage.chatName || currentChat.chatName,
        chatType: flaggedMessage.chatType,
        dmPartnerUser: flaggedMessage.dmPartnerUser,
        lastReadMessageId: Math.max(flaggedMessage.messageId, currentChat.lastReadMessageId),
        messages: messages,
        latestMessage: messages[messages.length - 1],
        latestMessageText: messages[messages.length - 1].contentText,
        TSLastMessage: flaggedMessage.tsSent,
        moveToSpecificIndex: moveToSpecificIndex,
        isPrivate: currentChat.isPrivate,
        profileImagePath: currentChat.profileImagePath,
        mdmMembers: currentChat.mdmMembers,
    };
};

const isCurrentChat = (
    currentSubChat: ChatProps | undefined,
    flaggedMessage: FlaggedMessageProps
): boolean => {
    return (
        currentSubChat?.chatId === flaggedMessage.chatId &&
        currentSubChat?.chatName === flaggedMessage.chatName
    );
};

const shouldHideThread = (isCreatingTask: boolean, isTaskPreviewVisible: boolean): boolean => {
    return isCreatingTask || isTaskPreviewVisible;
};

export const ChatListItemForFlagMessages = (props: ChatListItemForFlagMessagesProps) => {
    const {
        flaggedMessage,
        myself,
        selectedFlaggedMessageId,
        setCurrentProject,
        setMyself,
        useUISM,
        setSelectedFlaggedMessageId,
        socket,
        useTEM,
        useCM,
        useTM,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const isYou = myself.userId === flaggedMessage.dmPartnerUser.userId;
    const [tmpIsFlagged, setTmpIsFlagged] = useState(true);
    // Set when click-time message lookup discovers the source message has
    // since been deleted (or was scrubbed from IDB). The flagged-message
    // snapshot still has its content, so we keep rendering the row but mark
    // it visually and refuse to navigate.
    const [sourceDeleted, setSourceDeleted] = useState(false);
    const flagColor = FLAGGED_COLOR_SCHEME;

    // The flag entry can outlive the underlying chat (delete a GM, leave an
    // MDM, drop a project, etc.). When that happens the chat is gone from
    // `useCM.allChats`, so navigation would crash with "Chat not found".
    // Detect at render-time and degrade gracefully.
    const chatRecord = findChatForFlag(useCM.allChats, flaggedMessage);
    const chatRemoved = chatRecord === undefined;
    const navigationDisabled = chatRemoved || sourceDeleted;

    // Flag status management
    const updateFlagStatus = async () => {
        try {
            // Update backend
            await updateFlagMessage(accessToken, myself, {
                chat_type: flaggedMessage.chatType,
                chat_id: flaggedMessage.chatId,
                thread_id: flaggedMessage.threadId,
                message_id: flaggedMessage.messageId,
            });

            setTmpIsFlagged(false);

            // Remove from local state
            useCM.setFlaggedMessages(
                useCM.flaggedMessages.filter(
                    (message: FlaggedMessageProps) =>
                        message.flaggedMessageId !== flaggedMessage.flaggedMessageId
                )
            );

            // Remove from IndexedDB using FlaggedService
            const flaggedService = new FlaggedService();
            await flaggedService.deleteFlaggedMessage(flaggedMessage.flaggedMessageId);

            // Update the isFlagged status in IndexedDB without navigating away
            try {
                const messages = await popSpecificMessages(
                    flaggedMessage.chatId,
                    flaggedMessage.chatType
                );
                const updatedMessage = messages.find(
                    (m: MessageProps) => m.messageId === flaggedMessage.messageId
                );
                if (updatedMessage) {
                    await addMessage(
                        { ...updatedMessage, isFlagged: false },
                        flaggedMessage.chatType
                    );
                }
            } catch {
                // Non-critical: IndexedDB message update can fail silently
            }

            // If the user is currently viewing this chat, update isFlagged in the pane
            if (
                useCM.currentMainChat &&
                useCM.currentMainChat.chatId === flaggedMessage.chatId &&
                useCM.currentMainChat.chatType === flaggedMessage.chatType
            ) {
                useCM.setCurrentMainChat({
                    ...useCM.currentMainChat,
                    messages: useCM.currentMainChat.messages.map((m) =>
                        m.messageId === flaggedMessage.messageId ? { ...m, isFlagged: false } : m
                    ),
                    notMove: true,
                });
            }
        } catch (error) {
            console.error("Error updating flag status:", error);
        }
    };

    /**
     * Look up the source message in IDB (via popSpecificMessages) and
     * return both the unflipped message slice and the target message's
     * current state. Chat messages are purged from IDB on delete (see
     * `handleMessageDeletion` in message-handlers.ts) so the only signal
     * we get is "not present in the result" — that's what `deleted` means
     * here. `MessageProps` itself has no `isDeleted` field.
     */
    const loadMessagesAndTarget = async (): Promise<{
        messages: MessageProps[];
        target: MessageProps | undefined;
        deleted: boolean;
    }> => {
        const messages = await popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType);
        const target = messages.find((m) => m.messageId === flaggedMessage.messageId);
        return { messages, target, deleted: !target };
    };

    const updateMessagesAndChat = async () => {
        try {
            const { messages, target, deleted } = await loadMessagesAndTarget();
            if (deleted || !target) {
                setSourceDeleted(true);
                return;
            }

            // Update the isFlagged status of the target message
            const updatedMessages: MessageProps[] = messages.map((message: MessageProps) =>
                message.messageId === flaggedMessage.messageId
                    ? { ...message, isFlagged: !message.isFlagged }
                    : message
            );

            const updatedTarget = updatedMessages.find(
                (m) => m.messageId === flaggedMessage.messageId
            );
            if (updatedTarget) {
                await addMessage(updatedTarget, flaggedMessage.chatType);
            }

            const newChat = createChatFromMessages(
                updatedMessages,
                `${flaggedMessage.chatId}-${flaggedMessage.messageId}`,
                flaggedMessage,
                useCM.allChats
            );
            if (!newChat) return; // chat removed concurrently

            useCM.setCurrentMainChat(newChat);
            useCM.setIsMainChatVisible(true);

            if (shouldHideThread(useTM.isCreatingTask.flag, useTM.isTaskPreviewVisible)) {
                useCM.setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error updating messages and chat:", error);
        }
    };

    /**
     * Navigate to the source chat for a non-thread flagged message.
     * Treats DM / GM / PM / MDM uniformly — there's no separate
     * "task comment" path because flagging is only ever done from a chat
     * bubble, never from a task comment view.
     */
    const handleNonThreadMessage = async () => {
        const isCurrentChatVisible = isCurrentChat(useCM.currentSubChat, flaggedMessage);

        try {
            const { messages, deleted } = await loadMessagesAndTarget();
            if (deleted) {
                setSourceDeleted(true);
                return;
            }

            const newChat = createChatFromMessages(
                messages,
                `${flaggedMessage.chatId}-${flaggedMessage.messageId}`,
                flaggedMessage,
                useCM.allChats
            );
            if (!newChat) return; // chat was removed between render and click

            toggleMessagesPane();

            if (useCM.isSubChatVisible && isCurrentChatVisible) {
                useCM.setCurrentSubChat(newChat);
            } else {
                useCM.setCurrentMainChat(newChat);
            }

            useCM.setIsMainChatVisible(true);

            if (shouldHideThread(useTM.isCreatingTask.flag, useTM.isTaskPreviewVisible)) {
                useCM.setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error handling non-thread flagged message:", error);
        }
    };

    const handleThreadMessage = async () => {
        try {
            const threadMessages = await loadSpecificThreadMessages(
                myself,
                flaggedMessage.chatType,
                flaggedMessage.chatId,
                flaggedMessage.threadId,
                accessToken
            );

            // Empty / missing thread response = thread was deleted upstream.
            if (!threadMessages || threadMessages.length === 0) {
                setSourceDeleted(true);
                return;
            }

            const targetThreadMsg = threadMessages.find(
                (m: ThreadMessageProps) => m.messageId === flaggedMessage.messageId
            );
            if (!targetThreadMsg || targetThreadMsg.isDeleted === true) {
                setSourceDeleted(true);
                return;
            }

            const newThread = createThreadFromMessages(threadMessages);

            // Set thread visible BEFORE setting main chat to prevent
            // the main chat URL effect from stripping thread info
            useCM.setIsThreadVisible(true);
            useCM.setCurrentThreadChat(newThread);

            if (flaggedMessage.project?.projectId) {
                setCurrentProject(flaggedMessage.project);
            }

            if (newThread.taskExist && threadMessages[0].taskId) {
                useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
            }

            await handleThreadNavigation();
        } catch (error) {
            console.error("Error handling thread message:", error);
        }
    };

    const createThreadFromMessages = (threadMessages: ThreadMessageProps[]): ThreadProps => {
        return {
            chatId: flaggedMessage.chatId,
            chatName: flaggedMessage.chatName,
            threadId: flaggedMessage.threadId,
            chatType: flaggedMessage.chatType,
            dmPartnerUser: {
                teamId: myself.teamId,
                teamName: myself.teamName,
                userId: flaggedMessage.dmPartnerUser.userId,
                userName: flaggedMessage.dmPartnerUser.userName,
                userEmail: flaggedMessage.dmPartnerUser.userEmail,
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
            },
            taskId: flaggedMessage.taskId,
            messages: threadMessages,
            project: flaggedMessage.project,
            TSLastMessage: getLocalCurrentTimestamp(),
            taskExist: threadMessages[0].taskExist,
            moveToSpecificIndex: `${flaggedMessage.chatId}-${flaggedMessage.threadId}-${flaggedMessage.messageId}`,
        };
    };

    const handleThreadNavigation = async () => {
        const isCurrentChatVisible = isCurrentChat(useCM.currentSubChat, flaggedMessage);

        try {
            const messages = await popSpecificMessages(
                flaggedMessage.chatId,
                flaggedMessage.chatType
            );
            const newChat = createChatFromMessages(
                messages,
                `${flaggedMessage.chatId}-${flaggedMessage.threadId}-${flaggedMessage.messageId}`,
                flaggedMessage,
                useCM.allChats
            );
            if (!newChat) return;

            toggleMessagesPane();

            if (useCM.isSubChatVisible && isCurrentChatVisible) {
                useCM.setCurrentSubChat(newChat);
            } else {
                useCM.setCurrentMainChat(newChat);
            }

            useCM.setIsMainChatVisible(true);
        } catch (error) {
            console.error("Error handling thread navigation:", error);
        }
    };

    const onClickHandler = async () => {
        // The chat (or the source message itself) has been removed since
        // this flag entry was created — short-circuit and let the user
        // unflag via the right-side icon. Selecting still gives the row a
        // visual "active" state so the click isn't perceived as broken.
        if (navigationDisabled) {
            setSelectedFlaggedMessageId(flaggedMessage.flaggedMessageId);
            return;
        }

        // set to true to not move chat pane type
        useCM.setNotMoveChatPaneType(true);

        setSelectedFlaggedMessageId(flaggedMessage.flaggedMessageId);

        if (flaggedMessage.threadId === 0) {
            await handleNonThreadMessage();
        } else {
            await handleThreadMessage();
        }
    };

    // Avatar rendering components
    const renderDMAvatar = () => {
        if (flaggedMessage.dmPartnerUser.userId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={useTEM.teamMemberProfiles[flaggedMessage.dmPartnerUser.userId]}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useUISM={useUISM}
                />
            );
        }
        return <Avatar size="sm">{(resolvedChatName || "?")[0].toUpperCase()}</Avatar>;
    };

    const renderGMAvatar = () => {
        const chat = useCM.allChats.find(
            (chat) =>
                chat.chatType === flaggedMessage.chatType && chat.chatId === flaggedMessage.chatId
        );

        if (chat) {
            return (
                <GMAvatar
                    useCM={useCM}
                    gmChat={chat}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm">
                <GroupsIcon />
            </Avatar>
        );
    };

    const renderProjectAvatar = () => {
        if (chatRecord) {
            return (
                <ProjectAvatar
                    useCM={useCM}
                    myself={myself}
                    pmChat={chatRecord}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm">
                <AssignmentIcon />
            </Avatar>
        );
    };

    const renderMDMAvatar = () => (
        <MDMAvatar
            members={chatRecord?.mdmMembers}
            teamMemberProfiles={useTEM.teamMemberProfiles}
        />
    );

    // Fallback for any chat that has been removed entirely — we still need
    // *something* in the avatar slot so the row layout stays consistent.
    const renderRemovedAvatar = () => (
        <Avatar size="sm" sx={{ opacity: 0.55, filter: "grayscale(0.6)" }}>
            <PeopleRoundedIcon />
        </Avatar>
    );

    const renderAvatar = () => {
        if (chatRemoved) return renderRemovedAvatar();
        switch (flaggedMessage.chatType) {
            case CHAT_TYPES.DM:
                return renderDMAvatar();
            case CHAT_TYPES.GM:
                return renderGMAvatar();
            case CHAT_TYPES.PM:
                return renderProjectAvatar();
            case CHAT_TYPES.MDM:
                return renderMDMAvatar();
            default:
                return null;
        }
    };

    // Chip rendering components
    const resolvedChatName = (() => {
        if (flaggedMessage.chatName) return flaggedMessage.chatName;
        const chat = useCM.allChats.find(
            (c) => c.chatId === flaggedMessage.chatId && c.chatType === flaggedMessage.chatType
        );
        return chat?.chatName || "";
    })();

    const renderChatNameChip = () => {
        // DM / GM / MDM all show the (potentially auto-generated) chat name
        // prominently at the start of the row. PM hides the title here
        // because the project name is rendered as a coloured chip below.
        if (
            flaggedMessage.chatType === CHAT_TYPES.DM ||
            flaggedMessage.chatType === CHAT_TYPES.GM ||
            flaggedMessage.chatType === CHAT_TYPES.MDM
        ) {
            return (
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        lineHeight: 1.3,
                    }}
                    noWrap
                >
                    {isYou ? `${resolvedChatName} (you)` : resolvedChatName}
                </Typography>
            );
        }
        return null;
    };

    const renderProjectChips = () => {
        // PM messages live inside a project, so we show the project chip
        // and (when applicable) the task ID. MDM intentionally skips this
        // block — it has no project context.
        if (flaggedMessage.chatType !== CHAT_TYPES.PM) return null;
        return (
            <>
                <Chip
                    color="primary"
                    size="sm"
                    variant="soft"
                    sx={{
                        fontSize: "10px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        px: 0.75,
                        height: "20px",
                    }}
                >
                    {resolvedChatName}
                </Chip>
                {!!flaggedMessage.taskId && (
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            fontSize: "10px",
                            borderRadius: "6px",
                            fontWeight: 600,
                            px: 0.75,
                            height: "20px",
                        }}
                    >
                        {formatTaskDisplayId(flaggedMessage)}
                    </Chip>
                )}
            </>
        );
    };

    const renderRemovedChip = (label: string) => (
        <Chip
            color="neutral"
            size="sm"
            variant="outlined"
            sx={{
                fontSize: "10px",
                borderRadius: "6px",
                fontWeight: 600,
                px: 0.75,
                height: "20px",
                opacity: 0.85,
            }}
        >
            {label}
        </Chip>
    );

    const renderChatTypeChip = () => (
        <Chip
            color="neutral"
            size="sm"
            variant="soft"
            sx={{
                fontSize: "10px",
                borderRadius: "6px",
                fontWeight: 600,
                px: 0.75,
                height: "20px",
                opacity: 0.8,
            }}
        >
            {CHAT_TYPE_LABELS[flaggedMessage.chatType as keyof typeof CHAT_TYPE_LABELS] ||
                t.chat.listItem.unknown}
        </Chip>
    );

    const renderThreadChip = () => {
        if (flaggedMessage.threadId !== 0) {
            return (
                <Chip
                    color="warning"
                    size="sm"
                    variant="soft"
                    sx={{
                        fontSize: "10px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        px: 0.75,
                        height: "20px",
                    }}
                >
                    {t.chat.listItem.threadChip}
                </Chip>
            );
        }
        return null;
    };

    const isSelected = selectedFlaggedMessageId === flaggedMessage.flaggedMessageId;

    return (
        <React.Fragment>
            <ListItem
                sx={{
                    width: "100%",
                    p: 0.5,
                    overflowX: "hidden",
                }}
            >
                <ListItemButton
                    data-chat-list-key={`flagged-${flaggedMessage.flaggedMessageId}`}
                    onClick={onClickHandler}
                    sx={{
                        flexDirection: "column",
                        alignItems: "initial",
                        gap: 0.75,
                        py: 1.25,
                        px: 1.5,
                        borderRadius: "12px",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        opacity: navigationDisabled ? 0.65 : 1,
                        cursor: navigationDisabled ? "default" : undefined,
                        background: isSelected
                            ? isDark
                                ? `linear-gradient(135deg, ${flagColor.dark}15 0%, ${flagColor.dark}08 100%)`
                                : `linear-gradient(135deg, ${flagColor.light}12 0%, ${flagColor.light}05 100%)`
                            : isDark
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(0,0,0,0.01)",
                        border: "1px solid",
                        borderColor: isSelected
                            ? isDark
                                ? `${flagColor.dark}30`
                                : `${flagColor.light}25`
                            : isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.04)",
                        boxShadow: isSelected
                            ? isDark
                                ? `0 4px 16px ${flagColor.dark}15, inset 0 1px 0 ${flagColor.dark}10`
                                : `0 4px 16px ${flagColor.light}12, inset 0 1px 0 ${flagColor.light}08`
                            : "none",
                        "&:hover": {
                            background: isSelected
                                ? isDark
                                    ? `linear-gradient(135deg, ${flagColor.dark}20 0%, ${flagColor.dark}12 100%)`
                                    : `linear-gradient(135deg, ${flagColor.light}15 0%, ${flagColor.light}08 100%)`
                                : isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                            borderColor: isSelected
                                ? isDark
                                    ? `${flagColor.dark}40`
                                    : `${flagColor.light}35`
                                : isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: isSelected
                                ? isDark
                                    ? `0 6px 20px ${flagColor.dark}20`
                                    : `0 6px 20px ${flagColor.light}15`
                                : isDark
                                  ? "0 4px 12px rgba(0,0,0,0.3)"
                                  : "0 4px 12px rgba(0,0,0,0.08)",
                        },
                        "&:active": {
                            transform: "translateY(0)",
                        },
                    }}
                >
                    {/* Flagged indicator line */}
                    {tmpIsFlagged && (
                        <Box
                            sx={{
                                position: "absolute",
                                left: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 3,
                                height: "60%",
                                borderRadius: "0 4px 4px 0",
                                background: isDark
                                    ? `linear-gradient(180deg, ${flagColor.dark} 0%, ${flagColor.dark}80 100%)`
                                    : `linear-gradient(180deg, ${flagColor.light} 0%, ${flagColor.light}80 100%)`,
                                boxShadow: isDark
                                    ? `0 0 8px ${flagColor.dark}60`
                                    : `0 0 8px ${flagColor.light}50`,
                            }}
                        />
                    )}

                    {/* Subtle gradient overlay for selected state */}
                    {isSelected && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "50%",
                                height: "100%",
                                background: isDark
                                    ? `radial-gradient(ellipse at top right, ${flagColor.dark}08 0%, transparent 70%)`
                                    : `radial-gradient(ellipse at top right, ${flagColor.light}06 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                    <Stack
                        direction="column"
                        spacing={0.5}
                        sx={{ position: "relative", zIndex: 1 }}
                    >
                        {/* Header with avatar, name, and actions */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                        >
                            <Stack direction="row" spacing={1} alignItems="center">
                                <div>{renderAvatar()}</div>

                                <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    flexWrap="wrap"
                                >
                                    {renderChatNameChip()}
                                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                        {renderProjectChips()}
                                        {renderChatTypeChip()}
                                        {renderThreadChip()}
                                        {chatRemoved &&
                                            renderRemovedChip(t.chat.listItem.chatRemoved)}
                                        {!chatRemoved &&
                                            sourceDeleted &&
                                            renderRemovedChip(t.chat.listItem.messageDeleted)}
                                    </Box>
                                </Stack>
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        display: { xs: "none", md: "block" },
                                        opacity: 0.7,
                                    }}
                                    noWrap
                                >
                                    {extractYYYYMMDDHHMM(flaggedMessage.tsSent)}
                                </Typography>
                                <Tooltip
                                    size="sm"
                                    title={t.chat.listItem.unflag}
                                    variant="outlined"
                                >
                                    <IconButton
                                        color={tmpIsFlagged ? "danger" : "neutral"}
                                        size="sm"
                                        variant="plain"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateFlagStatus();
                                        }}
                                        sx={{
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                transform: "scale(1.1)",
                                            },
                                        }}
                                    >
                                        <FlagIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        {/* Message content */}
                        <Box sx={{ pl: "44px" }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 500,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    opacity: navigationDisabled ? 0.55 : 0.85,
                                    lineHeight: 1.5,
                                    textDecoration: navigationDisabled ? "line-through" : "none",
                                    fontStyle: navigationDisabled ? "italic" : "normal",
                                }}
                            >
                                {flaggedMessage.contentText}
                            </Typography>
                        </Box>
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider
                sx={{
                    margin: 0,
                    opacity: isDark ? 0.04 : 0.06,
                }}
            />
        </React.Fragment>
    );
};
