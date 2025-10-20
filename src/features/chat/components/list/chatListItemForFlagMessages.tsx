import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagIcon from "@mui/icons-material/Flag";
import GroupsIcon from "@mui/icons-material/Groups";
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
import * as React from "react";
import { useState } from "react";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { FlaggedService } from "../../../../db/services/flagged.service";
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
import { toggleMessagesPane } from "../../../../utils";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { addMessage } from "../../services/addMessage";
import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../../services/popSpecificMessages";
import { updateFlagMessage } from "../../services/updateFlagMessage";

// Constants
const CHAT_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    TASK: 4,
} as const;

const CHAT_TYPE_LABELS = {
    [CHAT_TYPES.DM]: "DM",
    [CHAT_TYPES.GM]: "GM",
    [CHAT_TYPES.PM]: "PM",
} as const;

// Types
interface ChatNavigationProps {
    allChats: AllChatProps[];
    currentSubChat?: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isSubChatVisible: boolean;
}

interface TaskCreationProps {
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
}

interface FlaggedMessageActions {
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (value: string) => void;
}

type ChatListItemForFlagMessagesProps = ListItemButtonProps & {
    flaggedMessage: FlaggedMessageProps;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
} & ChatNavigationProps &
    TaskCreationProps &
    FlaggedMessageActions;

// Helper functions
const createChatFromMessages = (
    messages: MessageProps[],
    moveToSpecificIndex: string,
    flaggedMessage: FlaggedMessageProps,
    allChats: AllChatProps[]
): ChatProps => {
    const chatType =
        flaggedMessage.chatType === CHAT_TYPES.TASK ? CHAT_TYPES.PM : flaggedMessage.chatType;
    const currentChat = allChats.find(
        (chat) => chat.chatType === chatType && chat.chatId === flaggedMessage.chatId
    );

    if (!currentChat) {
        throw new Error(`Chat not found for type ${chatType} and id ${flaggedMessage.chatId}`);
    }

    return {
        chatId: flaggedMessage.chatId,
        chatName: flaggedMessage.chatName,
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
        selectedFlaggedMessageId,
        setSelectedFlaggedMessageId,
        teamMemberProfiles,
        socket,
        flaggedMessage,
        flaggedMessages,
        setFlaggedMessages,
        myself,
        setMyself,
        allChats,
        currentSubChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        isSubChatVisible,
        setOpeningService,
        setCurrentProject,
        setCurrentPreviewTaskId,
        funcSetAllChats,
    } = props;
    const { accessToken } = useAuth();

    const isYou = myself.userId === flaggedMessage.dmPartnerUser.userId;
    const [tmpIsFlagged, setTmpIsFlagged] = useState(true);

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
            setFlaggedMessages(
                flaggedMessages.filter(
                    (message) => message.flaggedMessageId !== flaggedMessage.flaggedMessageId
                )
            );

            // Remove from IndexedDB using FlaggedService
            const flaggedService = new FlaggedService();
            await flaggedService.deleteFlaggedMessage(flaggedMessage.flaggedMessageId);

            // Update messages and chat
            await updateMessagesAndChat();
        } catch (error) {
            console.error("Error updating flag status:", error);
        }
    };

    const updateMessagesAndChat = async () => {
        try {
            const messages = await popSpecificMessages(
                flaggedMessage.chatId,
                flaggedMessage.chatType
            );

            // Update the isFlagged status of the target message
            const updatedMessages: MessageProps[] = messages.map((message: MessageProps) =>
                message.messageId === flaggedMessage.messageId
                    ? { ...message, isFlagged: !message.isFlagged }
                    : message
            );

            // Save updated message to IndexedDB
            const updatedMessage = updatedMessages.find(
                (message: MessageProps) => message.messageId === flaggedMessage.messageId
            );
            if (updatedMessage) {
                await addMessage(updatedMessage, flaggedMessage.chatType);
            }

            // Update current main chat
            setCurrentMainChat(
                createChatFromMessages(
                    updatedMessages,
                    `${flaggedMessage.chatId}-${flaggedMessage.messageId}`,
                    flaggedMessage,
                    allChats
                )
            );

            setIsMainChatVisible(true);

            if (shouldHideThread(isCreatingTask.flag, isTaskPreviewVisible)) {
                setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error updating messages and chat:", error);
        }
    };

    // Navigation handlers
    const handleNonThreadMessage = async () => {
        if (flaggedMessage.chatType === CHAT_TYPES.TASK) {
            await handleTaskComment();
        } else {
            await handleRegularMessage();
        }
    };

    const handleRegularMessage = async () => {
        const isCurrentChatVisible = isCurrentChat(currentSubChat, flaggedMessage);

        try {
            const messages = await popSpecificMessages(
                flaggedMessage.chatId,
                flaggedMessage.chatType
            );
            const newChat = createChatFromMessages(
                messages,
                `${flaggedMessage.chatId}-${flaggedMessage.messageId}`,
                flaggedMessage,
                allChats
            );

            toggleMessagesPane();

            if (isSubChatVisible && isCurrentChatVisible) {
                setCurrentSubChat(newChat);
            } else {
                setCurrentMainChat(newChat);
            }

            setIsMainChatVisible(true);

            if (shouldHideThread(isCreatingTask.flag, isTaskPreviewVisible)) {
                setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error handling regular message:", error);
        }
    };

    const handleTaskComment = async () => {
        if (!isCurrentChat(currentSubChat, flaggedMessage)) {
            try {
                const messages = await popSpecificMessages(flaggedMessage.chatId, CHAT_TYPES.PM);
                const newChat = createChatFromMessages(
                    messages,
                    `${flaggedMessage.chatId}-${flaggedMessage.messageId}`,
                    flaggedMessage,
                    allChats
                );

                toggleMessagesPane();
                setCurrentMainChat(newChat);

                if (flaggedMessage.project?.projectId) {
                    setCurrentProject(flaggedMessage.project);
                    setCurrentPreviewTaskId(flaggedMessage.taskId);
                    setIsThreadVisible(false);
                    setIsTaskPreviewVisible(true);
                }

                setIsMainChatVisible(true);

                if (shouldHideThread(isCreatingTask.flag, isTaskPreviewVisible)) {
                    setIsThreadVisible(false);
                }
            } catch (error) {
                console.error("Error handling task comment:", error);
            }
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

            if (threadMessages?.length > 0) {
                const newThread = createThreadFromMessages(threadMessages);
                setCurrentThreadChat(newThread);

                if (flaggedMessage.project?.projectId) {
                    setCurrentProject(flaggedMessage.project);
                }

                if (newThread.taskExist && threadMessages[0].taskId) {
                    setCurrentPreviewTaskId(threadMessages[0].taskId);
                }

                await handleThreadNavigation();
                setIsThreadVisible(true);
            }
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
            moveToSpecificIndex: flaggedMessage.flaggedMessageId,
        };
    };

    const handleThreadNavigation = async () => {
        const isCurrentChatVisible = isCurrentChat(currentSubChat, flaggedMessage);

        try {
            const messages = await popSpecificMessages(
                flaggedMessage.chatId,
                flaggedMessage.chatType
            );
            const newChat = createChatFromMessages(
                messages,
                `${flaggedMessage.chatId}-${flaggedMessage.threadId}-${flaggedMessage.messageId}`,
                flaggedMessage,
                allChats
            );

            toggleMessagesPane();

            if (isSubChatVisible && isCurrentChatVisible) {
                setCurrentSubChat(newChat);
            } else {
                setCurrentMainChat(newChat);
            }

            setIsMainChatVisible(true);

            if (shouldHideThread(isCreatingTask.flag, isTaskPreviewVisible)) {
                setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error handling thread navigation:", error);
        }
    };

    const onClickHandler = async () => {
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
                    avatarUser={teamMemberProfiles[flaggedMessage.dmPartnerUser.userId]}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                />
            );
        }
        return <Avatar size="sm">{flaggedMessage.chatName[0].toUpperCase()}</Avatar>;
    };

    const renderGMAvatar = () => {
        const chat = allChats.find(
            (chat) =>
                chat.chatType === flaggedMessage.chatType && chat.chatId === flaggedMessage.chatId
        );

        if (chat) {
            return (
                <GMAvatar
                    funcSetAllChats={funcSetAllChats}
                    gmChat={chat}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
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
        const chat = allChats.find(
            (chat) =>
                chat.chatType === flaggedMessage.chatType && chat.chatId === flaggedMessage.chatId
        );

        if (chat) {
            return (
                <ProjectAvatar
                    funcSetAllChats={funcSetAllChats}
                    myself={myself}
                    pmChat={chat}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
                />
            );
        }
        return (
            <Avatar size="sm">
                <AccountTreeIcon />
            </Avatar>
        );
    };

    const renderTaskAvatar = () => (
        <Avatar size="sm">
            <AssignmentRoundedIcon />
        </Avatar>
    );

    const renderAvatar = () => {
        switch (flaggedMessage.chatType) {
            case CHAT_TYPES.DM:
                return renderDMAvatar();
            case CHAT_TYPES.GM:
                return renderGMAvatar();
            case CHAT_TYPES.PM:
                return renderProjectAvatar();
            case CHAT_TYPES.TASK:
                return renderTaskAvatar();
            default:
                return null;
        }
    };

    // Chip rendering components
    const renderChatNameChip = () => {
        if (
            flaggedMessage.chatType === CHAT_TYPES.DM ||
            flaggedMessage.chatType === CHAT_TYPES.GM
        ) {
            return (
                <Typography level="title-sm" sx={{ pt: "3px" }} noWrap>
                    {isYou ? `${flaggedMessage.chatName} (you)` : flaggedMessage.chatName}
                </Typography>
            );
        }
        return null;
    };

    const renderProjectChips = () => {
        if (
            flaggedMessage.chatType === CHAT_TYPES.PM ||
            flaggedMessage.chatType === CHAT_TYPES.TASK
        ) {
            return (
                <>
                    <Chip
                        color="primary"
                        size="sm"
                        variant="soft"
                        sx={{
                            fontSize: "12px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                        }}
                    >
                        {flaggedMessage.chatName}
                    </Chip>
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            fontSize: "12px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                        }}
                    >
                        ID:{flaggedMessage.taskId}
                    </Chip>
                </>
            );
        }
        return null;
    };

    const renderChatTypeChip = () => (
        <Chip
            color="neutral"
            size="sm"
            variant="outlined"
            sx={{
                fontSize: "12px",
                borderRadius: "4px",
                fontWeight: "bold",
            }}
        >
            {CHAT_TYPE_LABELS[flaggedMessage.chatType as keyof typeof CHAT_TYPE_LABELS] ||
                "Unknown"}
        </Chip>
    );

    const renderThreadChip = () => {
        if (flaggedMessage.threadId !== 0) {
            return (
                <Chip
                    color="neutral"
                    size="sm"
                    variant="outlined"
                    sx={{
                        fontSize: "12px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                    }}
                >
                    Thread
                </Chip>
            );
        }
        return null;
    };

    const isSelected = selectedFlaggedMessageId === flaggedMessage.flaggedMessageId;

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    color={isSelected ? "success" : "neutral"}
                    sx={{ flexDirection: "column", alignItems: "initial", gap: 1 }}
                    variant={isSelected ? "soft" : "outlined"}
                    onClick={onClickHandler}
                >
                    <Stack direction="column">
                        {/* Header with avatar, name, and actions */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                        >
                            <Stack direction="row" spacing={1}>
                                <div>{renderAvatar()}</div>

                                <Stack direction="row" spacing={0.5}>
                                    {renderChatNameChip()}
                                    <Box>
                                        {renderProjectChips()}
                                        {renderChatTypeChip()}
                                        {renderThreadChip()}
                                    </Box>
                                </Stack>
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    sx={{ display: { xs: "none", md: "block" } }}
                                    noWrap
                                >
                                    {extractYYYYMMDDHHMM(flaggedMessage.tsSent)}
                                </Typography>
                                <Tooltip size="sm" title="Unflag" variant="outlined">
                                    <IconButton
                                        color={tmpIsFlagged ? "danger" : "neutral"}
                                        size="sm"
                                        variant="plain"
                                        onClick={updateFlagStatus}
                                    >
                                        <FlagIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        {/* Message content */}
                        <Stack
                            alignItems="flex-start"
                            direction="row"
                            justifyContent="space-between"
                        >
                            <Typography
                                level="body-sm"
                                sx={{
                                    marginBottom: 0.5,
                                    ml: "45px",
                                    fontWeight: "bold",
                                    display: "-webkit-box",
                                    WebkitLineClamp: "2",
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {flaggedMessage.contentText}
                            </Typography>
                        </Stack>
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
};
