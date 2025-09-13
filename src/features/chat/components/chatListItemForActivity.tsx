import * as React from "react";
import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Avatar, Box, Chip, Tooltip, ListDivider, ListItem, Stack, Typography } from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

import { useAuth } from "../../../context/AuthContext";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { AvatarWithStatus } from "../../../components/utils/avatarWithStatus";
import { UserProps } from "../../../types/admin";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { ProjectProps } from "../../../types/tasks";
import {
    ActivityMessageProps,
    ChatProps,
    ThreadProps,
    ThreadMessageProps,
} from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { extractYYYYMMDDHHMM, getCurrentTimestamp } from "../../../utils/dateUtils";
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task Comment}
// activityType = {1: message or comment, 2: reaction, 3: mention}

type ChatListItemForActivityProps = ListItemButtonProps & {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    activity: ActivityMessageProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
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
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const ChatListItemForActivity = (props: ChatListItemForActivityProps) => {
    const {
        teamMemberProfiles,
        socket,
        activity,
        myself,
        setMyself,
        currentMainChat,
        currentSubChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
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
        setCurrentProject,
        setCurrentPreviewTaskId,
    } = props;
    const { accessToken } = useAuth();

    const isYou = myself.userId === activity.dmPartnerUser.userId;

    const defineNewChat = (messages: any, moveToSpecificIndex: string) => {
        const newChat: ChatProps = {
            chatId: activity.chatId,
            chatName: activity.chatName,
            chatType: activity.chatType,
            dmPartnerUser: activity.dmPartnerUser,
            isRead: false,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: activity.tsSent,
            moveToSpecificIndex: moveToSpecificIndex,
        };
        return newChat;
    };

    const onClickHandler = async () => {
        if (activity.isThread === false) {
            // Handling a non-thread message/comment
            if (activity.chatType !== 4) {
                // Handling a message activity in DM, GM, PM
                if (
                    isSubChatVisible === false ||
                    `${currentSubChat.chatId}-${currentSubChat.chatName}` !==
                        `${activity.chatId}-${activity.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(activity.chatId, activity.chatType)
                        .then((messages) => {
                            setCurrentMainChat(defineNewChat(messages, activity.messageUniqueKey));
                            if (isThreadVisible) {
                                setIsMainChatVisible(true);
                                if (isTaskCreationVisible || isTaskPreviewVisible) {
                                    setIsThreadVisible(false);
                                }
                            }
                        })
                        .catch((error) => console.error(error));
                }
                if (
                    isSubChatVisible === true ||
                    `${currentSubChat.chatId}-${currentSubChat.chatName}` ===
                        `${activity.chatId}-${activity.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(activity.chatId, activity.chatType)
                        .then((messages) => {
                            setCurrentSubChat(defineNewChat(messages, activity.messageUniqueKey));
                            if (isThreadVisible) {
                                setIsMainChatVisible(true);
                                if (isTaskCreationVisible || isTaskPreviewVisible) {
                                    setIsThreadVisible(false);
                                }
                            }
                        })
                        .catch((error) => console.error(error));
                }
            } else {
                // Handling a task comment activity
                if (
                    isSubChatVisible === false ||
                    `${currentSubChat.chatId}-${currentSubChat.chatName}` !==
                        `${activity.chatId}-${activity.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(activity.chatId, 3)
                        .then((messages) => {
                            setCurrentMainChat(defineNewChat(messages, activity.messageUniqueKey));
                            if (activity.project) {
                                setCurrentProject(activity.project);
                                setCurrentPreviewTaskId(activity.taskId);
                                setIsThreadVisible(false);
                                setIsTaskPreviewVisible(true);
                            }
                            if (isThreadVisible) {
                                setIsMainChatVisible(true);
                                if (isTaskCreationVisible || isTaskPreviewVisible) {
                                    setIsThreadVisible(false);
                                }
                            }
                        })
                        .catch((error) => console.error(error));
                }
            }
        } else {
            // Handling a thread message
            const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
                myself,
                activity.chatType,
                activity.chatId,
                activity.threadId,
                accessToken
            );
            if (threadMessages && threadMessages.length > 0) {
                const newThread: ThreadProps = {
                    chatId: activity.chatId,
                    chatName: activity.chatName,
                    threadId: activity.threadId,
                    chatType: activity.chatType,
                    dmPartnerUser: activity.dmPartnerUser,
                    taskId: activity.taskId,
                    isRead: false,
                    messages: threadMessages,
                    project: activity.project,
                    TSLastMessage: getCurrentTimestamp(),
                    taskExist: threadMessages[0].taskExist,
                    moveToSpecificIndex: activity.threadMessageUniqueKey,
                };
                if (activity.project) {
                    setCurrentProject(activity.project);
                }
                if (newThread) {
                    setCurrentThreadChat(newThread);
                    if (newThread.taskExist === true && threadMessages[0].taskId) {
                        setCurrentPreviewTaskId(threadMessages[0].taskId);
                    }
                }

                if (
                    isSubChatVisible === false ||
                    `${currentSubChat.chatId}-${currentSubChat.chatName}` !==
                        `${activity.chatId}-${activity.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(activity.chatId, activity.chatType)
                        .then((messages) => {
                            setCurrentMainChat(defineNewChat(messages, activity.messageUniqueKey));
                            if (isThreadVisible) {
                                setIsMainChatVisible(true);
                                if (isTaskCreationVisible || isTaskPreviewVisible) {
                                    setIsThreadVisible(false);
                                }
                            }
                        })
                        .catch((error) => console.error(error));
                }
                if (
                    isSubChatVisible === true ||
                    `${currentSubChat.chatId}-${currentSubChat.chatName}` ===
                        `${activity.chatId}-${activity.chatName}`
                ) {
                    toggleMessagesPane();
                    popSpecificMessages(activity.chatId, activity.chatType)
                        .then((messages) => {
                            setCurrentSubChat(defineNewChat(messages, activity.messageUniqueKey));
                            if (isThreadVisible) {
                                setIsMainChatVisible(true);
                                if (isTaskCreationVisible || isTaskPreviewVisible) {
                                    setIsThreadVisible(false);
                                }
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
        4: "Task Comment",
    };

    const groupEmojis = (reactions: ReactionProps[]): GroupedReactionProps[] => {
        const map = new Map<string, { count: number; senders: UserProps[] }>();

        reactions.forEach(({ emoji, sender }) => {
            const entry = map.get(emoji);
            if (entry) {
                entry.count += 1;
                entry.senders.push(sender);
            } else {
                map.set(emoji, { count: 1, senders: [sender] });
            }
        });

        return Array.from(map.entries())
            .map(([emoji, { count, senders }]) => ({
                emoji,
                count,
                senders,
            }))
            .sort((a, b) => b.count - a.count);
    };

    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(activity.reactions.allReactions)
    );
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    useEffect(() => {
        setGroupedReactions(groupEmojis(activity.reactions.allReactions));
    }, [activity]);

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    onClick={onClickHandler}
                    color="neutral"
                    variant="outlined"
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
                                    {activity.chatType === 1 &&
                                        activity.dmPartnerUser.userId !== "" && (
                                            <AvatarWithStatus
                                                myself={myself}
                                                setMyself={setMyself}
                                                avatarUser={
                                                    teamMemberProfiles[
                                                        activity.dmPartnerUser.userId
                                                    ]
                                                }
                                                socket={socket}
                                                setOpeningService={setOpeningService}
                                                setCurrentMainChat={setCurrentMainChat}
                                            />
                                        )}
                                    {activity.chatType === 1 &&
                                        activity.dmPartnerUser.userId === "" && (
                                            <Avatar size="sm">
                                                {activity.chatName[0].toUpperCase()}
                                            </Avatar>
                                        )}
                                    {activity.chatType === 2 && (
                                        <Avatar size="sm">
                                            <GroupsIcon />
                                        </Avatar>
                                    )}
                                    {activity.chatType === 3 && (
                                        <Avatar size="sm">
                                            <AccountTreeIcon />
                                        </Avatar>
                                    )}
                                    {activity.chatType === 4 && (
                                        <Avatar size="sm">
                                            <AssignmentRoundedIcon />
                                        </Avatar>
                                    )}
                                </div>

                                {activity.chatType !== 3 && activity.chatType !== 4 && (
                                    <Box>
                                        <Typography noWrap level="title-sm">
                                            {isYou
                                                ? `${activity.chatName} (you)`
                                                : activity.chatName}
                                        </Typography>
                                    </Box>
                                )}

                                <Box>
                                    {(activity.chatType === 3 || activity.chatType === 4) && (
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
                                                {activity.chatName}
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
                                                ID:{activity.taskId}
                                            </Chip>
                                        </>
                                    )}

                                    {activity.activityType === 1 && (
                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            color="success"
                                            sx={{
                                                fontSize: "12px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            Reply
                                        </Chip>
                                    )}
                                    {activity.activityType === 2 && (
                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            color="warning"
                                            sx={{
                                                fontSize: "12px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            Reaction
                                        </Chip>
                                    )}
                                    {activity.activityType === 3 && (
                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            color="danger"
                                            sx={{
                                                fontSize: "12px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            Mention
                                        </Chip>
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
                                        {chatTypeLookup[activity.chatType]}
                                    </Chip>
                                    {activity.isThread === true && (
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
                            {/* Right-aligned content */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    noWrap
                                    sx={{ display: { xs: "none", md: "block" } }}
                                >
                                    {extractYYYYMMDDHHMM(activity.tsSent)}
                                </Typography>
                            </Stack>
                        </Stack>

                        {activity.activityType !== 2 && (
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
                                    {activity.firstLineContent}
                                </Typography>
                            </Stack>
                        )}

                        {activity.activityType === 2 && (
                            <>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="flex-start"
                                >
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="flex-start"
                                    >
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                paddingTop: 1.5,
                                                ml: "45px",
                                                fontWeight: "bold",
                                                display: "-webkit-box",
                                                WebkitLineClamp: "2",
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {activity.latestReaction.sender.userName} has reacted
                                        </Typography>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontSize: "25px",
                                                pl: "10px",
                                                display: "-webkit-box",
                                                WebkitLineClamp: "2",
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {activity.latestReaction.emoji}
                                        </Typography>
                                    </Stack>

                                    <Box sx={{ paddingTop: 0.5 }}>
                                        {displayed.map(({ senders, emoji, count }, index) => (
                                            <Tooltip
                                                key={`tooltip-${index}`}
                                                title={
                                                    senders
                                                        .slice(0, 5)
                                                        .map((sender) => `${sender.userName} `)
                                                        .join(" and ") +
                                                    (senders.length > 5 ? " and more" : "") +
                                                    " reacted"
                                                }
                                            >
                                                <Chip
                                                    key={`emoji-chip-${emoji}-${index}`}
                                                    variant={
                                                        senders.some(
                                                            (u) => u.userId === myself.userId
                                                        )
                                                            ? "solid"
                                                            : "outlined"
                                                    }
                                                    color="neutral"
                                                    size="sm"
                                                    sx={{
                                                        fontSize: "0.8rem",
                                                        cursor: "pointer",
                                                        px: 0.5,
                                                        py: 0.5,
                                                    }}
                                                >
                                                    {emoji}
                                                    {count}
                                                </Chip>
                                            </Tooltip>
                                        ))}

                                        {hidden.length > 0 && (
                                            <Tooltip
                                                title={hidden
                                                    .map(({ emoji, count }) => `${emoji} ${count}`)
                                                    .join(" ")}
                                            >
                                                <Chip
                                                    size="sm"
                                                    variant="plain"
                                                    sx={{ fontSize: "0.8rem" }}
                                                >
                                                    +{hidden.length} more
                                                </Chip>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </Stack>
                                <Box sx={{ lineHeight: 0, textAlign: "right" }}>
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
                                        {activity.firstLineContent}
                                    </Typography>
                                </Box>
                            </>
                        )}
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
};
