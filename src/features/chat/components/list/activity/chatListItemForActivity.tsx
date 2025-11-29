import * as React from "react";
import { ListDivider, ListItem, Stack } from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../../types/chat";
import { ProjectProps } from "../../../../../types/tasks";
import { toggleMessagesPane } from "../../../../../utils/sidebarUtils";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { loadSpecificThreadMessages } from "../../../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../../../services/popSpecificMessages";
import { ActivityContent } from "./ActivityContent";
import { ActivityHeader } from "./ActivityHeader";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task}
// activityType = {1: message or comment, 2: reaction, 3: mention}

type ChatListItemForActivityProps = ListItemButtonProps & {
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    myself: UserProps;
    selectedActivityId: string;
    setCurrentProject: (value: ProjectProps) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    setSelectedActivityId: (value: string) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const ChatListItemForActivity = (props: ChatListItemForActivityProps) => {
    const {
        useTEM,
        selectedActivityId,
        setSelectedActivityId,
        socket,
        activity,
        activityMessages,
        myself,
        setMyself,
        useUISM,
        setCurrentProject,
        useCM,
        useTM,
    } = props;
    const { accessToken } = useAuth();
    const { groupedReactions, updateActivityReadStatus } = useActivityStatus({
        activity,
        activityMessages,
        useCM,
        myself,
        accessToken,
    });

    const isYou = myself.userId === activity.dmPartnerUserId;

    const defineNewChat = (messages: any, moveToSpecificIndex: string) => {
        let chatType: number = activity.chatType;
        if (activity.chatType === 4) {
            chatType = 3;
        }
        const currentChat: AllChatProps = useCM.allChats.filter(
            (chat) => chat.chatType === chatType && chat.chatId === activity.chatId
        )[0];
        const newChat: ChatProps = {
            chatId: activity.chatId,
            chatName: activity.chatName,
            chatType: chatType,
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
    const handleChatNavigation = async (
        chatType: number,
        isThread: boolean,
        messageUniqueKey: string
    ) => {
        const shouldUseMainChat =
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        const shouldUseSubChat =
            useCM.isSubChatVisible === true ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` ===
                `${activity.chatId}-${activity.chatName}`;

        const handleMessages = (messages: any) => {
            if (shouldUseMainChat) {
                useCM.setCurrentMainChat(defineNewChat(messages, messageUniqueKey));
            } else if (shouldUseSubChat) {
                useCM.setCurrentSubChat(defineNewChat(messages, messageUniqueKey));
            }
            useCM.setIsMainChatVisible(true);
            if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                useCM.setIsThreadVisible(false);
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
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        if (shouldUseMainChat) {
            toggleMessagesPane();
            try {
                const messages = await popSpecificMessages(activity.chatId, 3);
                useCM.setCurrentMainChat(defineNewChat(messages, activity.messageUniqueKey));

                if (activity.projectId) {
                    setCurrentProject({
                        projectId: activity.projectId,
                        projectName: activity.projectName || "",
                        projectTags: [],
                    });
                    useCM.setIsThreadVisible(false);
                    useTM.setIsTaskPreviewVisible(true);
                }
                useCM.setIsMainChatVisible(true);
                if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                    useCM.setIsThreadVisible(false);
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
                    useCM.setCurrentThreadChat(newThread);
                    if (newThread.taskExist === true && threadMessages[0].taskId) {
                        useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
                    }
                }

                await handleChatNavigation(
                    activity.chatType,
                    activity.isThread,
                    activity.messageUniqueKey
                );
            }

            useCM.setIsThreadVisible(true);
        } catch (error) {
            console.error(error);
        }
    };

    const onClickHandler = async () => {
        console.log("onClickHandler", activity);
        setSelectedActivityId(activity.activityId);

        if (activity.isThread === false) {
            if (activity.chatType !== 4) {
                // Handling a message activity in DM, GM, PM
                await handleChatNavigation(
                    activity.chatType,
                    activity.isThread,
                    activity.messageUniqueKey
                );
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
                            chatTypeLookup={chatTypeLookup}
                            useCM={useCM}
                            isYou={isYou}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />

                        <ActivityContent
                            activity={activity}
                            groupedReactions={groupedReactions}
                            myself={myself}
                        />
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
};
