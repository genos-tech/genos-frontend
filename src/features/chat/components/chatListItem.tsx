import * as React from "react";
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
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { popSpecificMessages } from "../services/popSpecificMessages";
import { AvatarWithStatus } from "../../../components/utils/avatarWithStatus";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";

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
    isThreadVisible: boolean;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isTaskCreationVisible: boolean;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    chatType: number;
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
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        isTaskPreviewVisible,
        isTaskCreationVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        chatType,
    } = props;

    const selected =
        `${currentMainChat.chatName}-${currentMainChat.chatId}` ===
            `${chat.chatName}-${chat.chatId}` ||
        (isSubChatVisible &&
            `${currentSubChat.chatName}-${currentSubChat.chatId}` ===
                `${chat.chatName}-${chat.chatId}`);

    const isYou = myself.userId === chat.dmPartnerUser?.userId;

    const defineNewMessages = (messages: any) => {
        const newMessages: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            unread: false,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: chat.TSLastMessage,
            systemUserId: chat.systemUserId,
            project: chat.project,
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
            chat.unread = Boolean(false); // TODO: Fix
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    setCurrentMainChat(defineNewMessages(messages));
                    // Switch Thread to Main
                    if (isThreadVisible) {
                        setIsMainChatVisible(true);
                        if (isTaskCreationVisible || isTaskPreviewVisible) {
                            setIsThreadVisible(false);
                        }
                    }
                })
                .catch((error) => console.error(error));
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
                        setCurrentSubChat(defineNewMessages(messages));
                        if (isThreadVisible) {
                            setIsMainChatVisible(true);
                            if (isTaskCreationVisible || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        }
                    })
                    .catch((error) => console.error(error));
            } else {
                popSpecificMessages(chat.chatId, chat.chatType)
                    .then((messages) => {
                        setCurrentSubChat(defineNewMessages(messages));
                        if (isThreadVisible) {
                            setIsMainChatVisible(true);
                            if (isTaskCreationVisible || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        }
                    })
                    .catch((error) => console.error(error));
            }
            setIsSubChatVisible(true);
        }
    };

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", px: 1, overflowX: "hidden" }}>
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
                                    {chatType === 1 && chat.dmPartnerUser !== null && (
                                        <AvatarWithStatus
                                            myself={myself}
                                            setMyself={setMyself}
                                            avatarUser={
                                                teamMemberProfiles[chat.dmPartnerUser.userId]
                                            }
                                            socket={socket}
                                            chat={chat}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    )}
                                    {chatType === 1 && chat.dmPartnerUser === null && (
                                        <Avatar size="sm">{chat.chatName[0]}</Avatar>
                                    )}
                                    {chatType === 2 && (
                                        <Avatar size="sm">
                                            <GroupsIcon />
                                        </Avatar>
                                    )}
                                    {chatType === 3 && (
                                        <Avatar size="sm">
                                            <AccountTreeIcon />
                                        </Avatar>
                                    )}
                                </div>
                                <Box>
                                    <Typography noWrap level="title-sm">
                                        {isYou ? `${chat.chatName} (you)` : chat.chatName}
                                    </Typography>
                                </Box>

                                {chat.dmPartnerUser !== null &&
                                    ((teamMemberProfiles[chat.dmPartnerUser.userId] &&
                                        teamMemberProfiles[chat.dmPartnerUser.userId]
                                            .customStatus !== "") ||
                                        (myself.userId === chat.dmPartnerUser.userId &&
                                            myself.customStatus != "")) && (
                                        <Chip
                                            variant="outlined"
                                            size="sm"
                                            sx={{ borderRadius: "sm", height: "10px" }}
                                        >
                                            {myself.userId === chat.dmPartnerUser.userId
                                                ? myself.customStatus
                                                : teamMemberProfiles[chat.dmPartnerUser.userId]
                                                      .customStatus}
                                        </Chip>
                                    )}
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    noWrap
                                    sx={{ display: { xs: "none", md: "block" } }}
                                >
                                    {chat.latestMessage
                                        ? extractYYYYMMDDHHMM(chat.latestMessage.tsSent)
                                        : ""}
                                </Typography>
                                {chat.unread && (
                                    <CircleIcon sx={{ fontSize: 12 }} color="primary" />
                                )}
                                <Tooltip title="Split View " size="sm">
                                    <IconButton
                                        component="a"
                                        onClick={(event) => {
                                            event.stopPropagation(); // Stop the click from reaching ListItemButton
                                            splitOpenHandler(); // Call the intended function
                                        }}
                                    >
                                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        <Box sx={{ lineHeight: 0, textAlign: "right" }}>
                            <Typography
                                level="body-sm"
                                sx={{
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
