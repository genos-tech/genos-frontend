import * as React from "react";
import { useState } from "react";
import { Socket } from "socket.io-client";
import {
    Avatar,
    Box,
    Tooltip,
    ListDivider,
    ListItem,
    Stack,
    Typography,
    IconButton,
    Chip,
} from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import CircleIcon from "@mui/icons-material/Circle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PushPinIcon from "@mui/icons-material/PushPin";
import LockOutlineIcon from "@mui/icons-material/LockOutline";

import { addChat } from "../services/addChat";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { AvatarWithStatus } from "../../../components/common/avatarWithStatus";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";
import { GMAvatar } from "../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../components/common/ProjectAvatar";
import { updatePinnedChats } from "../services/updatePinnedChats";
import { useAuth } from "../../../context/AuthContext";

type ChatListItemProps = ListItemButtonProps & {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    chat: AllChatProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    chatType: number;
    funcSetAllChats: () => Promise<void>;
    allChats: AllChatProps[];
    isPinnedChat: boolean;
};

export const ChatListItem = (props: ChatListItemProps) => {
    const {
        teamMemberProfiles,
        socket,
        chat,
        myself,
        setMyself,
        currentMainChat,
        currentSubChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        chatType,
        funcSetAllChats,
        allChats,
        isPinnedChat,
    } = props;

    const { accessToken } = useAuth();

    const [isPinned, setIsPinned] = useState(chat.isPinned);

    const selected =
        `${currentMainChat.chatName}-${currentMainChat.chatId}` ===
            `${chat.chatName}-${chat.chatId}` ||
        (isSubChatVisible &&
            `${currentSubChat.chatName}-${currentSubChat.chatId}` ===
                `${chat.chatName}-${chat.chatId}`);

    const isYou = myself.userId === chat.dmPartnerUser.userId;

    const defineNewChat = (messages: any) => {
        const newMessages: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            lastReadMessageId: messages[messages.length - 1].messageId,
            messages: messages,
            latestMessage: chat.latestMessage,
            latestMessageText: chat.latestMessageText,
            TSLastMessage: chat.TSLastMessage,
            systemUserId: chat.systemUserId,
            project: chat.project,
            isPrivate: chat.isPrivate,
            profileImagePath: chat.profileImagePath,
            isPinned: chat.isPinned,
        };
        return newMessages;
    };

    const onClickHandler = () => {
        if (
            isSubChatVisible === false ||
            `${currentSubChat.chatId}-${currentSubChat.chatName}` !==
                `${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    const newChat: ChatProps = defineNewChat(messages);
                    setCurrentMainChat(newChat);
                    addChat(newChat, chat.chatType);

                    setIsMainChatVisible(true);

                    if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                        setIsThreadVisible(false);
                    }
                })
                .catch((error) => console.error(error));

            if (isPinnedChat) {
                localStorage.setItem("lastChatType", "4");
                localStorage.setItem("lastPinnedChatId", chat.chatId.toString() || "");
                localStorage.setItem("lastPinnedChatType", chat.chatType.toString() || "");
            }
        }
    };

    const splitOpenHandler = () => {
        if (
            `${currentMainChat.chatId}-${currentMainChat.chatName}` !==
            `${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            if (chat.chatType === 1) {
                popSpecificMessages(chat.chatId, chat.chatType)
                    .then((messages) => {
                        setCurrentSubChat(defineNewChat(messages));
                        setIsMainChatVisible(true);
                        if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                            setIsThreadVisible(false);
                        }
                    })
                    .catch((error) => console.error(error));
            } else {
                popSpecificMessages(chat.chatId, chat.chatType)
                    .then((messages) => {
                        setCurrentSubChat(defineNewChat(messages));
                        setIsMainChatVisible(true);
                        if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                            setIsThreadVisible(false);
                        }
                    })
                    .catch((error) => console.error(error));
            }
            setIsSubChatVisible(true);
        }
    };

    const pinChatHandler = async (chatId: number, chatType: number) => {
        // Update pinned chats. If chat is pinned, remove it from the list, otherwise add it to the list.
        const updatedAllChats = allChats.map((chat) => ({
            ...chat,
            isPinned:
                chat.chatId === chatId && chat.chatType === chatType
                    ? !chat.isPinned
                    : chat.isPinned,
        }));

        await updatePinnedChats(
            accessToken,
            myself,
            updatedAllChats
                .map((chat) =>
                    chat.isPinned ? { chat_type: chat.chatType, chat_id: chat.chatId } : null
                )
                .filter((chat) => chat !== null)
        );

        await addChat({ ...chat, isPinned: !chat.isPinned }, chatType);
        funcSetAllChats();
    };

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    onClick={onClickHandler}
                    selected={selected}
                    variant="soft"
                    color="neutral"
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
                                    {chatType === 1 && chat.dmPartnerUser.userId !== "" && (
                                        <AvatarWithStatus
                                            myself={myself}
                                            setMyself={setMyself}
                                            isYou={isYou}
                                            avatarUser={
                                                teamMemberProfiles[chat.dmPartnerUser.userId]
                                            }
                                            socket={socket}
                                            chat={chat}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    )}
                                    {chatType === 1 && chat.dmPartnerUser.userId === "" && (
                                        <Avatar size="sm">{chat.chatName[0].toUpperCase()}</Avatar>
                                    )}
                                    {chatType === 2 && (
                                        <GMAvatar
                                            teamMemberProfiles={teamMemberProfiles}
                                            myself={myself}
                                            setMyself={setMyself}
                                            isYou={isYou}
                                            socket={socket}
                                            gmChat={chat}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                            funcSetAllChats={funcSetAllChats}
                                        />
                                    )}
                                    {chatType === 3 && (
                                        <ProjectAvatar
                                            teamMemberProfiles={teamMemberProfiles}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            pmChat={chat}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                            funcSetAllChats={funcSetAllChats}
                                        />
                                    )}
                                </div>

                                <Typography
                                    noWrap
                                    level="title-sm"
                                    sx={{ pt: "3px", pl: "5px" }}
                                    startDecorator={
                                        chat.isPrivate ? (
                                            <LockOutlineIcon sx={{ fontSize: "16px" }} />
                                        ) : undefined
                                    }
                                >
                                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
                                </Typography>

                                {/* show my own custom status */}
                                {chat.dmPartnerUser.userId !== "" &&
                                    myself.userId === chat.dmPartnerUser.userId &&
                                    myself.customStatus != "" && (
                                        <Chip
                                            component="h2"
                                            variant="outlined"
                                            size="md"
                                            sx={{ borderRadius: "sm", height: "10px" }}
                                        >
                                            {myself.customStatus}
                                        </Chip>
                                    )}

                                {/* show others custom status */}
                                {chat.dmPartnerUser.userId !== "" &&
                                    myself.userId !== chat.dmPartnerUser.userId &&
                                    teamMemberProfiles[chat.dmPartnerUser.userId] &&
                                    teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !==
                                        "" && (
                                        <Chip
                                            component="h2"
                                            variant="outlined"
                                            size="md"
                                            sx={{ borderRadius: "sm", height: "10px" }}
                                        >
                                            {
                                                teamMemberProfiles[chat.dmPartnerUser.userId]
                                                    .customStatus
                                            }
                                        </Chip>
                                    )}
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack direction="row" alignItems="center">
                                <Typography
                                    level="body-xs"
                                    noWrap
                                    sx={{ display: { xs: "none", md: "block" } }}
                                >
                                    {chat.latestMessage
                                        ? extractYYYYMMDDHHMM(chat.latestMessage.tsSent)
                                        : ""}
                                </Typography>
                                <Tooltip title="Pin Chat" size="sm">
                                    <IconButton
                                        component="a"
                                        color={chat.isPinned ? "danger" : "neutral"}
                                        sx={{ mr: -1 }}
                                        onClick={(event) => {
                                            event.stopPropagation(); // Stop the click from reaching ListItemButton
                                            pinChatHandler(chat.chatId, chat.chatType); // Call the intended function
                                            setIsPinned(!isPinned);
                                        }}
                                    >
                                        <PushPinIcon sx={{ fontSize: isPinned ? 18 : 16 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Split View " size="sm">
                                    <IconButton
                                        component="a"
                                        onClick={(event) => {
                                            event.stopPropagation(); // Stop the click from reaching ListItemButton
                                            splitOpenHandler(); // Call the intended function
                                        }}
                                    >
                                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                                {chat.latestMessage &&
                                    chat.lastReadMessageId < chat.latestMessage?.messageId && (
                                        <CircleIcon sx={{ mr: 1, fontSize: 12 }} color="primary" />
                                    )}
                            </Stack>
                        </Stack>

                        <Box sx={{ lineHeight: 0, textAlign: "left" }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    ml: "45px",
                                    fontWeight: "bold",
                                    display: "-webkit-box",
                                    WebkitLineClamp: "2",
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {chat.latestMessageText}
                            </Typography>
                        </Box>
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
};
