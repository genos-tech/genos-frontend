import * as React from "react";
import { Box, ListDivider, ListItem, Stack } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
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
import { ProjectProps, TaskProps } from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { toggleMessagesPane } from "../../../../../utils/sidebarUtils";
import { loadSpecificTask } from "../../../../tasks/services/loadSpecificTask";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import { loadSpecificThreadMessages } from "../../../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../../../services/popSpecificMessages";
import { ActivityContent } from "./ActivityContent";
import { ActivityHeader } from "./ActivityHeader";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task-comment OR MDM}
//   chat_type=4 is dual-purpose: task-comment activities carry a `taskId`
//   (and `chatId === project_id`), MDM activities don't (`chatId === mdm_id`).
// activityType = {1: message or comment, 2: reaction, 3: mention}

// Activity type color schemes for visual distinction
const ACTIVITY_COLOR_SCHEMES = {
    reply: { dark: "#4ade80", light: "#22c55e" },
    reaction: { dark: "#fbbf24", light: "#f59e0b" },
    mention: { dark: "#f87171", light: "#ef4444" },
    default: { dark: "#a78bfa", light: "#7c3aed" },
} as const;

type ChatListItemForActivityProps = {
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

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
    const navigate = useNavigate();

    const { groupedReactions, updateActivityReadStatus } = useActivityStatus({
        activity,
        activityMessages,
        useCM,
        myself,
        accessToken,
    });

    const isYou = myself.userId === activity.dmPartnerUserId;
    const isSelected = selectedActivityId === activity.activityId;

    // Get color scheme based on activity type
    const getActivityColor = () => {
        switch (activity.activityType) {
            case 1:
                return ACTIVITY_COLOR_SCHEMES.reply;
            case 2:
                return ACTIVITY_COLOR_SCHEMES.reaction;
            case 3:
                return ACTIVITY_COLOR_SCHEMES.mention;
            default:
                return ACTIVITY_COLOR_SCHEMES.default;
        }
    };

    const activityColor = getActivityColor();

    // For task-comment activities (chat_type=4 + taskId truthy), the actual
    // chat is the underlying PM (chat_type=3) — clicking the activity opens
    // the project chat. MDM activities (chat_type=4 without taskId) are
    // their own chats and must NOT be remapped to PM.
    const isTaskComment = activity.chatType === 4 && !!activity.taskId;

    const defineNewChat = (messages: any, moveToSpecificIndex: string) => {
        const chatType: number = isTaskComment ? 3 : activity.chatType;
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

    // Load the thread task if exists
    const loadTask = () => {
        (async () => {
            if (activity.projectId && activity.taskId) {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    activity.projectId,
                    activity.taskId,
                    accessToken
                );
                if (loadedTask.length > 0) {
                    useTM.setCurrentPreviewTask(loadedTask[0]);
                }
            }
        })();
    };

    // Handle task comment activity — opens the PM chat AND the task's
    // comment thread (mirrors MessageBubble.replayHandler). ThreadChatPane
    // defaults to the "comments" tab for PM threads with a valid taskId,
    // which surfaces ThreadCommentsView with the task's comments.
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
                }

                useCM.setIsMainChatVisible(true);
                useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));
                useTM.setIsTaskPreviewVisible(false);

                if (activity.taskId) {
                    loadTask();
                    useTM.setCurrentPreviewTaskId(activity.taskId);

                    const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
                        myself,
                        3,
                        activity.chatId,
                        activity.taskId,
                        accessToken
                    );

                    if (threadMessages && threadMessages.length > 0) {
                        const newThread: ThreadProps = {
                            chatId: activity.chatId,
                            chatName: activity.chatName,
                            threadId: activity.taskId,
                            chatType: 3,
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
                                projectId: activity.projectId || activity.chatId,
                                projectName: activity.projectName || "",
                                projectTags: [],
                            },
                            TSLastMessage: getLocalCurrentTimestamp(),
                            taskExist: threadMessages[0].taskExist,
                        };
                        useCM.setCurrentThreadChat(newThread);
                    }

                    // Deep-link to the specific comment so TaskCommentBubble
                    // picks up the focused tint. activity.messageId IS the
                    // commentId for task-comment activities (set from
                    // response["comment_id"] on the backend).
                    navigate(
                        `/workspace/chat/pm/${activity.chatId}/thread/${activity.taskId}/comment/${activity.messageId}`
                    );
                }
                useCM.setIsThreadVisible(true);
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
        // set to true to not move chat pane type
        useCM.setNotMoveChatPaneType(true);

        setSelectedActivityId(activity.activityId);

        if (activity.isThread === false) {
            if (isTaskComment) {
                // Handling a task-comment activity (chat_type=4 + taskId)
                await handleTaskCommentActivity();
            } else {
                // Handling a message activity in DM, GM, PM, or MDM
                // (MDM = chat_type=4 without taskId — same nav flow as
                // regular chats, just the chat lives under chat_type=4 in
                // allChats).
                await handleChatNavigation(
                    activity.chatType,
                    activity.isThread,
                    activity.messageUniqueKey
                );
            }
        } else {
            // Handling a thread message
            await handleThreadMessageActivity();
        }

        if (activity.isRead === false) {
            updateActivityReadStatus();
        }
    };

    // ActivityTypeChips replaces the chat-type label with "MDM" / "Task"
    // when activity.chatType === 4 (using `taskId` as the discriminator),
    // so this map only needs to cover the unambiguous DM / GM / PM cases.
    const chatTypeLookup: { [key: number]: string } = {
        1: "DM",
        2: "GM",
        3: "PM",
        4: "MDM",
    };

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
                    data-chat-list-key={`activity-${activity.activityId}`}
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
                        background: isSelected
                            ? isDark
                                ? `linear-gradient(135deg, ${activityColor.dark}15 0%, ${activityColor.dark}08 100%)`
                                : `linear-gradient(135deg, ${activityColor.light}12 0%, ${activityColor.light}05 100%)`
                            : isDark
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(0,0,0,0.01)",
                        border: "1px solid",
                        borderColor: isSelected
                            ? isDark
                                ? `${activityColor.dark}30`
                                : `${activityColor.light}25`
                            : isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.04)",
                        boxShadow: isSelected
                            ? isDark
                                ? `0 4px 16px ${activityColor.dark}15, inset 0 1px 0 ${activityColor.dark}10`
                                : `0 4px 16px ${activityColor.light}12, inset 0 1px 0 ${activityColor.light}08`
                            : "none",
                        "&:hover": {
                            background: isSelected
                                ? isDark
                                    ? `linear-gradient(135deg, ${activityColor.dark}20 0%, ${activityColor.dark}12 100%)`
                                    : `linear-gradient(135deg, ${activityColor.light}15 0%, ${activityColor.light}08 100%)`
                                : isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                            borderColor: isSelected
                                ? isDark
                                    ? `${activityColor.dark}40`
                                    : `${activityColor.light}35`
                                : isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: isSelected
                                ? isDark
                                    ? `0 6px 20px ${activityColor.dark}20`
                                    : `0 6px 20px ${activityColor.light}15`
                                : isDark
                                  ? "0 4px 12px rgba(0,0,0,0.3)"
                                  : "0 4px 12px rgba(0,0,0,0.08)",
                        },
                        "&:active": {
                            transform: "translateY(0)",
                        },
                    }}
                >
                    {/* Unread indicator line */}
                    {activity.isRead === false && (
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
                                    ? `linear-gradient(180deg, ${activityColor.dark} 0%, ${activityColor.dark}80 100%)`
                                    : `linear-gradient(180deg, ${activityColor.light} 0%, ${activityColor.light}80 100%)`,
                                boxShadow: isDark
                                    ? `0 0 8px ${activityColor.dark}60`
                                    : `0 0 8px ${activityColor.light}50`,
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
                                    ? `radial-gradient(ellipse at top right, ${activityColor.dark}08 0%, transparent 70%)`
                                    : `radial-gradient(ellipse at top right, ${activityColor.light}06 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                    <Stack
                        direction="column"
                        spacing={0.5}
                        sx={{ position: "relative", zIndex: 1 }}
                    >
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
            <ListDivider
                sx={{
                    margin: 0,
                    opacity: isDark ? 0.04 : 0.06,
                }}
            />
        </React.Fragment>
    );
};
