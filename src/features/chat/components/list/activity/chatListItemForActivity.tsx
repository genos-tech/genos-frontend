import * as React from "react";
import { ListDivider, ListItem, Stack } from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../../types/chat";
import { ProjectProps } from "../../../../../types/tasks";
import { toggleMessagesPane } from "../../../../../utils";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { loadSpecificThreadMessages } from "../../../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../../../services/popSpecificMessages";
import { ActivityContent } from "./ActivityContent";
import { ActivityHeader } from "./ActivityHeader";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task}
// activityType = {1: message or comment, 2: reaction, 3: mention}

type ChatListItemForActivityProps = ListItemButtonProps & {
    selectedActivityId: string;
    setSelectedActivityId: (value: string) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
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

export const ChatListItemForActivity = (props: ChatListItemForActivityProps) => {
    const {
        selectedActivityId,
        setSelectedActivityId,
        teamMemberProfiles,
        socket,
        activity,
        activityMessages,
        setActivityMessages,
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
    const { groupedReactions, updateActivityReadStatus } = useActivityStatus({
        activity,
        activityMessages,
        setActivityMessages,
        myself,
        accessToken,
    });

    const isYou = myself.userId === activity.dmPartnerUserId;

    const defineNewChat = (messages: any, moveToSpecificIndex: string) => {
        let chatType: number = activity.chatType;
        if (activity.chatType === 4) {
            chatType = 3;
        }
        const currentChat: AllChatProps = allChats.filter(
            (chat) => chat.chatType === chatType && chat.chatId === activity.chatId
        )[0];
        const newChat: ChatProps = {
            chatId: activity.chatId,
            chatName: activity.chatName,
            chatType: activity.chatType,
            dmPartnerUser: {
                teamId: myself.teamId,
                teamName: myself.teamName,
                userId: activity.dmPartnerUserId,
                userName: activity.dmPartnerUserName,
                userEmail: activity.dmPartnerUserEmail,
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
            },
            lastReadMessageId:
                currentChat && currentChat.lastReadMessageId
                    ? activity.messageId > currentChat.lastReadMessageId
                        ? activity.messageId
                        : currentChat.lastReadMessageId
                    : activity.messageId,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: activity.tsSent,
            moveToSpecificIndex: moveToSpecificIndex,
            isPrivate: currentChat.isPrivate,
            profileImagePath: currentChat.profileImagePath,
        };
        return newChat;
    };

    // Helper function to handle common chat navigation logic
    const handleChatNavigation = async (chatType: number, messageUniqueKey: string) => {
        const shouldUseMainChat =
            isSubChatVisible === false ||
            `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        const shouldUseSubChat =
            isSubChatVisible === true ||
            `${currentSubChat?.chatId}-${currentSubChat?.chatName}` ===
                `${activity.chatId}-${activity.chatName}`;

        const handleMessages = (messages: any) => {
            if (shouldUseMainChat) {
                setCurrentMainChat(defineNewChat(messages, messageUniqueKey));
            } else if (shouldUseSubChat) {
                setCurrentSubChat(defineNewChat(messages, messageUniqueKey));
            }
            setIsMainChatVisible(true);
            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                setIsThreadVisible(false);
            }
        };

        toggleMessagesPane();

        try {
            const messages = await popSpecificMessages(activity.chatId, chatType);
            handleMessages(messages);
        } catch (error) {
            console.error(error);
        }
    };

    // Handle task comment activity
    const handleTaskCommentActivity = async () => {
        const shouldUseMainChat =
            isSubChatVisible === false ||
            `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        if (shouldUseMainChat) {
            toggleMessagesPane();
            try {
                const messages = await popSpecificMessages(activity.chatId, 3);
                setCurrentMainChat(defineNewChat(messages, activity.messageUniqueKey));

                if (activity.projectId) {
                    setCurrentProject({
                        projectId: activity.projectId,
                        projectName: activity.projectName || "",
                        projectTags: [],
                    });
                    setCurrentPreviewTaskId(activity.taskId);
                    setIsThreadVisible(false);
                    setIsTaskPreviewVisible(true);
                }
                setIsMainChatVisible(true);
                if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                    setIsThreadVisible(false);
                }
            } catch (error) {
                console.error(error);
            }
        }
    };

    // Handle thread message activity
    const handleThreadMessageActivity = async () => {
        try {
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
                    dmPartnerUser: {
                        teamId: myself.teamId,
                        teamName: myself.teamName,
                        userId: activity.dmPartnerUserId,
                        userName: activity.dmPartnerUserName,
                        userEmail: activity.dmPartnerUserEmail,
                        avatarImgPath: "",
                        tsLastSeen: "",
                        tsJoined: "",
                    },
                    taskId: activity.taskId,
                    messages: threadMessages,
                    project: {
                        projectId: activity.projectId || -1,
                        projectName: activity.projectName || "",
                        projectTags: [],
                    },
                    TSLastMessage: getLocalCurrentTimestamp(),
                    taskExist: threadMessages[0].taskExist,
                    moveToSpecificIndex: activity.threadMessageUniqueKey,
                };

                if (activity.projectId) {
                    setCurrentProject({
                        projectId: activity.projectId,
                        projectName: activity.projectName || "",
                        projectTags: [],
                    });
                }

                if (newThread) {
                    setCurrentThreadChat(newThread);
                    if (newThread.taskExist === true && threadMessages[0].taskId) {
                        setCurrentPreviewTaskId(threadMessages[0].taskId);
                    }
                }

                await handleChatNavigation(activity.chatType, activity.messageUniqueKey);
            }

            setIsThreadVisible(true);
        } catch (error) {
            console.error(error);
        }
    };

    const onClickHandler = async () => {
        setSelectedActivityId(activity.activityId);

        if (activity.isThread === false) {
            if (activity.chatType !== 4) {
                // Handling a message activity in DM, GM, PM
                await handleChatNavigation(activity.chatType, activity.messageUniqueKey);
            } else {
                // Handling a task comment activity
                await handleTaskCommentActivity();
            }
        } else {
            // Handling a thread message
            await handleThreadMessageActivity();
        }

        if (activity.isRead === false) {
            updateActivityReadStatus();
        }
    };

    const chatTypeLookup: { [key: number]: string } = {
        1: "DM",
        2: "GM",
        3: "PM",
        4: "Task",
    };

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    color={selectedActivityId === activity.activityId ? "success" : "neutral"}
                    sx={{ flexDirection: "column", alignItems: "initial", gap: 1 }}
                    variant={selectedActivityId === activity.activityId ? "soft" : "outlined"}
                    onClick={onClickHandler}
                >
                    <Stack direction="column">
                        <ActivityHeader
                            activity={activity}
                            myself={myself}
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            allChats={allChats}
                            setCurrentMainChat={setCurrentMainChat}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            funcSetAllChats={funcSetAllChats}
                            isYou={isYou}
                            chatTypeLookup={chatTypeLookup}
                        />

                        <ActivityContent
                            activity={activity}
                            myself={myself}
                            groupedReactions={groupedReactions}
                        />
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
};
