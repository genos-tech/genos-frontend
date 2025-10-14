import * as React from "react";
import { Socket } from "socket.io-client";
import { Avatar, Box, Chip, IconButton, ListDivider, ListItem, Stack, Typography } from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagIcon from "@mui/icons-material/Flag";

import { useAuth } from "../../../context/AuthContext";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { AvatarWithStatus } from "../../../components/common/avatarWithStatus";
import { UserProps } from "../../../types/admin";
import { ProjectProps } from "../../../types/tasks";
import {
    ChatProps,
    ThreadProps,
    ThreadMessageProps,
    AllChatProps,
    FlaggedMessageProps,
    MessageProps,
} from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";
import { updateFlagMessage } from "../services/updateFlagMessage";
import { useState } from "react";
import { deleteData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { addMessage } from "../services/addMessage";
import { GMAvatar } from "../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../components/common/ProjectAvatar";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task}
// flaggedMessageType = {1: message or comment, 2: reaction, 3: mention}

type ChatListItemForFlagMessagesProps = ListItemButtonProps & {
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (value: string) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    flaggedMessage: FlaggedMessageProps;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    allChats: AllChatProps[];
    currentSubChat?: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isSubChatVisible: boolean;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    funcSetAllChats: () => Promise<void>;
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

    const defineNewChat = (messages: any, moveToSpecificIndex: string) => {
        let chatType: number = flaggedMessage.chatType;
        if (flaggedMessage.chatType === 4) {
            chatType = 3;
        }
        const currentChat: AllChatProps = allChats.filter(
            (chat) => chat.chatType === chatType && chat.chatId === flaggedMessage.chatId
        )[0];
        const newChat: ChatProps = {
            chatId: flaggedMessage.chatId,
            chatName: flaggedMessage.chatName,
            chatType: flaggedMessage.chatType,
            dmPartnerUser: flaggedMessage.dmPartnerUser,
            lastReadMessageId:
                flaggedMessage.messageId > currentChat.lastReadMessageId
                    ? flaggedMessage.messageId
                    : currentChat.lastReadMessageId,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: flaggedMessage.tsSent,
            moveToSpecificIndex: moveToSpecificIndex,
            isPrivate: currentChat.isPrivate,
            profileImagePath: currentChat.profileImagePath,
        };
        return newChat;
    };

    const updateFlagStatus = () => {
        // Update the flagged message status in the backend
        updateFlagMessage(accessToken, myself, {
            chat_type: flaggedMessage.chatType,
            chat_id: flaggedMessage.chatId,
            thread_id: flaggedMessage.threadId,
            message_id: flaggedMessage.messageId,
        });

        setTmpIsFlagged(false);

        // Delete the flagged message from the flaggedMessages array
        setFlaggedMessages(
            flaggedMessages.filter(
                (message) => message.flaggedMessageId !== flaggedMessage.flaggedMessageId
            )
        );

        // Delete the flagged message from the indexedDB
        deleteData({ storeName: STORES.FLAGGED_MESSAGES, key: flaggedMessage.flaggedMessageId });

        popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType)
            .then((messages) => {
                // Update the isFlagged status of the target message. Keep the other messages unchanged.
                const updatedMessages: MessageProps[] = messages.map((message: MessageProps) =>
                    message.messageId === flaggedMessage.messageId
                        ? { ...message, isFlagged: !message.isFlagged }
                        : message
                );

                // Add the updated message to the indexedDB
                const updatedMessage: MessageProps | undefined = updatedMessages.find(
                    (message: MessageProps) => message.messageId === flaggedMessage.messageId
                );
                if (updatedMessage) {
                    addMessage(updatedMessage, flaggedMessage.chatType);
                }

                // Update the current main chat
                setCurrentMainChat(
                    defineNewChat(
                        updatedMessages,
                        `${flaggedMessage.chatId}-${flaggedMessage.messageId}`
                    )
                );

                // Set the current main chat visible
                setIsMainChatVisible(true);

                // Set the thread visible to false if the task preview is visible
                if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                    setIsThreadVisible(false);
                }
            })
            .catch((error) => console.error(error));
    };

    const onClickHandler = async () => {
        setSelectedFlaggedMessageId(flaggedMessage.flaggedMessageId);

        if (flaggedMessage.threadId === 0) {
            // Handling a non-thread message/comment
            if (flaggedMessage.chatType !== 4) {
                // Handling a message flaggedMessage in DM, GM, PM
                if (
                    isSubChatVisible === false ||
                    `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                        `${flaggedMessage.chatId}-${flaggedMessage.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType)
                        .then((messages) => {
                            setCurrentMainChat(
                                defineNewChat(
                                    messages,
                                    `${flaggedMessage.chatId}-${flaggedMessage.messageId}`
                                )
                            );
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        })
                        .catch((error) => console.error(error));
                }
                if (
                    isSubChatVisible === true ||
                    `${currentSubChat?.chatId}-${currentSubChat?.chatName}` ===
                        `${flaggedMessage.chatId}-${flaggedMessage.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType)
                        .then((messages) => {
                            setCurrentSubChat(
                                defineNewChat(
                                    messages,
                                    `${flaggedMessage.chatId}-${flaggedMessage.messageId}`
                                )
                            );
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        })
                        .catch((error) => console.error(error));
                }
            } else {
                // Handling a task comment flaggedMessage
                if (
                    isSubChatVisible === false ||
                    `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                        `${flaggedMessage.chatId}-${flaggedMessage.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(flaggedMessage.chatId, 3)
                        .then((messages) => {
                            setCurrentMainChat(
                                defineNewChat(
                                    messages,
                                    `${flaggedMessage.chatId}-${flaggedMessage.messageId}`
                                )
                            );
                            if (flaggedMessage.project && flaggedMessage.project.projectId) {
                                setCurrentProject(flaggedMessage.project);
                                setCurrentPreviewTaskId(flaggedMessage.taskId);
                                setIsThreadVisible(false);
                                setIsTaskPreviewVisible(true);
                            }
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        })
                        .catch((error) => console.error(error));
                }
            }
        } else {
            // Handling a thread message
            const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
                myself,
                flaggedMessage.chatType,
                flaggedMessage.chatId,
                flaggedMessage.threadId,
                accessToken
            );
            if (threadMessages && threadMessages.length > 0) {
                const newThread: ThreadProps = {
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
                if (flaggedMessage.project && flaggedMessage.project.projectId) {
                    setCurrentProject(flaggedMessage.project);
                }
                if (newThread) {
                    setCurrentThreadChat(newThread);
                    if (newThread.taskExist === true && threadMessages[0].taskId) {
                        setCurrentPreviewTaskId(threadMessages[0].taskId);
                    }
                }

                if (
                    isSubChatVisible === false ||
                    `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                        `${flaggedMessage.chatId}-${flaggedMessage.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType)
                        .then((messages) => {
                            setCurrentMainChat(
                                defineNewChat(
                                    messages,
                                    `${flaggedMessage.chatId}-${flaggedMessage.threadId}-${flaggedMessage.messageId}`
                                )
                            );
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        })
                        .catch((error) => console.error(error));
                }
                if (
                    isSubChatVisible === true ||
                    `${currentSubChat?.chatId}-${currentSubChat?.chatName}` ===
                        `${flaggedMessage.chatId}-${flaggedMessage.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(flaggedMessage.chatId, flaggedMessage.chatType)
                        .then((messages) => {
                            setCurrentSubChat(
                                defineNewChat(
                                    messages,
                                    `${flaggedMessage.chatId}-${flaggedMessage.threadId}-${flaggedMessage.messageId}`
                                )
                            );
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        })
                        .catch((error) => console.error(error));
                }
            }

            setIsThreadVisible(true);
        }
    };

    const chatTypeLookup: { [key: number]: string } = {
        1: "DM",
        2: "GM",
        3: "PM",
    };

    const chat = allChats.find(
        (chat) =>
            chat.chatType === flaggedMessage.chatType && chat.chatId === flaggedMessage.chatId
    );

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    onClick={onClickHandler}
                    color={
                        selectedFlaggedMessageId === flaggedMessage.flaggedMessageId
                            ? "success"
                            : "neutral"
                    }
                    variant={
                        selectedFlaggedMessageId === flaggedMessage.flaggedMessageId
                            ? "soft"
                            : "outlined"
                    }
                    sx={{ flexDirection: "column", alignItems: "initial", gap: 1 }}
                >
                    <Stack direction="column">
                        <Stack
                            direction="row"
                            spacing={1.5}
                            justifyContent="space-between"
                            alignItems="center"
                        >
                            <Stack direction="row" spacing={1}>
                                <div>
                                    {flaggedMessage.chatType === 1 &&
                                        flaggedMessage.dmPartnerUser.userId !== "" && (
                                            <AvatarWithStatus
                                                myself={myself}
                                                setMyself={setMyself}
                                                isYou={isYou}
                                                avatarUser={
                                                    teamMemberProfiles[
                                                        flaggedMessage.dmPartnerUser.userId
                                                    ]
                                                }
                                                socket={socket}
                                                setOpeningService={setOpeningService}
                                                setCurrentMainChat={setCurrentMainChat}
                                            />
                                        )}

                                    {flaggedMessage.chatType === 1 &&
                                        flaggedMessage.dmPartnerUser.userId === "" && (
                                            <Avatar size="sm">
                                                {flaggedMessage.chatName[0].toUpperCase()}
                                            </Avatar>
                                        )}

                                    {flaggedMessage.chatType === 2 && (
                                        <>
                                            {chat && (
                                                <GMAvatar
                                                    teamMemberProfiles={teamMemberProfiles}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    isYou={isYou}
                                                    socket={socket}
                                                    setOpeningService={setOpeningService}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    gmChat={chat}
                                                    funcSetAllChats={funcSetAllChats}
                                                />
                                            )}
                                            {chat === undefined && (
                                                <Avatar size="sm">
                                                    <GroupsIcon />
                                                </Avatar>
                                            )}
                                        </>
                                    )}

                                    {flaggedMessage.chatType === 3 && (
                                        <>
                                            {chat && (
                                                <ProjectAvatar
                                                    teamMemberProfiles={teamMemberProfiles}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socket}
                                                    setOpeningService={setOpeningService}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    pmChat={chat}
                                                    funcSetAllChats={funcSetAllChats}
                                                />
                                            )}
                                            {chat === undefined && (
                                                <Avatar size="sm">
                                                    <AccountTreeIcon />
                                                </Avatar>
                                            )}
                                        </>
                                    )}

                                    {flaggedMessage.chatType === 4 && (
                                        <Avatar size="sm">
                                            <AssignmentRoundedIcon />
                                        </Avatar>
                                    )}
                                </div>

                                <Stack direction="row" spacing={0.5}>
                                    {flaggedMessage.chatType !== 3 &&
                                        flaggedMessage.chatType !== 4 && (
                                            <Typography noWrap level="title-sm" sx={{ pt: "3px" }}>
                                                {isYou
                                                    ? `${flaggedMessage.chatName} (you)`
                                                    : flaggedMessage.chatName}
                                            </Typography>
                                        )}

                                    <Box>
                                        {(flaggedMessage.chatType === 3 ||
                                            flaggedMessage.chatType === 4) && (
                                            <>
                                                <Chip
                                                    size="sm"
                                                    variant="soft"
                                                    color="primary"
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
                                        )}

                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            color="neutral"
                                            sx={{
                                                fontSize: "12px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {chatTypeLookup[flaggedMessage.chatType]}
                                        </Chip>
                                        {flaggedMessage.threadId !== 0 && (
                                            <Chip
                                                size="sm"
                                                variant="outlined"
                                                color="neutral"
                                                sx={{
                                                    fontSize: "12px",
                                                    borderRadius: "4px",
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                Thread
                                            </Chip>
                                        )}
                                    </Box>
                                </Stack>
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    noWrap
                                    sx={{ display: { xs: "none", md: "block" } }}
                                >
                                    {extractYYYYMMDDHHMM(flaggedMessage.tsSent)}
                                </Typography>
                                <IconButton
                                    onClick={updateFlagStatus}
                                    size="sm"
                                    variant="plain"
                                    color={tmpIsFlagged ? "danger" : "neutral"}
                                >
                                    <FlagIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Stack>
                        </Stack>

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
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
