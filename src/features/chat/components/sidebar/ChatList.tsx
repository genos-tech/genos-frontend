import { useEffect, useRef, useState } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { Box, List, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ActivityMessageProps, AllChatProps, FlaggedMessageProps } from "../../../../types/chat";
import {
    useScrollToBottomOnChatPaneChange,
    useScrollToBottomOnNewActivity,
} from "../../hooks/messageBubbleHooks";
import { ChatListItemForActivity } from "./activity/chatListItemForActivity";
import { ChatListItem } from "./chatListItem";
import { ChatListItemForFlagMessages } from "./chatListItemForFlagMessages";

// Constants
const CHAT_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    PINNED: 4,
    ACTIVITY: 5,
    FLAGGED: 6,
} as const;

const ACTIVITY_TYPES = {
    ALL: 0,
    THREAD: 1,
    TASK: 2,
    MENTION: 3,
    REACTION: 4,
} as const;

const ACTIVITY_FILTERS = {
    [ACTIVITY_TYPES.ALL]: () => true,
    [ACTIVITY_TYPES.THREAD]: (item: ActivityMessageProps) => item.isThread === true,
    [ACTIVITY_TYPES.TASK]: (item: ActivityMessageProps) => item.chatType > 2,
    [ACTIVITY_TYPES.MENTION]: (item: ActivityMessageProps) => item.activityType === 3,
    [ACTIVITY_TYPES.REACTION]: (item: ActivityMessageProps) => item.activityType === 2,
} as const;

// Empty state configuration
const EMPTY_STATES: Record<number, { icon: React.ElementType; title: string; subtitle: string }> =
    {
        [CHAT_TYPES.DM]: {
            icon: ChatBubbleOutlineRoundedIcon,
            title: "No direct messages",
            subtitle: "Start a conversation with someone",
        },
        [CHAT_TYPES.GM]: {
            icon: ChatBubbleOutlineRoundedIcon,
            title: "No group messages",
            subtitle: "Create or join a group to get started",
        },
        [CHAT_TYPES.PM]: {
            icon: ChatBubbleOutlineRoundedIcon,
            title: "No project updates",
            subtitle: "Project conversations will appear here",
        },
        [CHAT_TYPES.ACTIVITY]: {
            icon: NotificationsNoneRoundedIcon,
            title: "No activities yet",
            subtitle: "Mentions and replies will show up here",
        },
        [CHAT_TYPES.FLAGGED]: {
            icon: FlagOutlinedIcon,
            title: "No flagged messages",
            subtitle: "Flag important messages to find them later",
        },
    };

// Interfaces for better prop organization
interface ChatListState {
    showOnlyUnreadItems: boolean;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
}

interface ChatListActions {
    setIsToDoVisible: (value: boolean) => void;
}

interface ChatListData {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
}

// Sort all chats by pinned status and then by TSLastMessage in desc
const sortAllChatByPinned = (allChats: AllChatProps[]) => {
    return allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();
    });
};

type ChatListProps = {
    socket: Socket | null;
    targetChatType: number;
    currentActivityMessageType: number;
    useCM: ChatManagementState;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
};

// Custom hook for managing filtered chats
const useFilteredChats = (
    allChats: AllChatProps[],
    targetChatType: number,
    showOnlyUnreadItems: boolean
) => {
    const [filteredChats, setFilteredChats] = useState<AllChatProps[]>(
        sortAllChatByPinned(allChats.filter((chat) => chat.chatType === targetChatType))
    );

    useEffect(() => {
        if (showOnlyUnreadItems) {
            const filteredChats = allChats
                .filter((chat) => chat.chatType === targetChatType)
                .filter(
                    (item) =>
                        item.lastReadMessageId <
                        (item.latestMessage
                            ? item.latestMessage.messageId
                            : item.lastReadMessageId + 1)
                );
            setFilteredChats(sortAllChatByPinned(filteredChats));
        } else {
            setFilteredChats(
                sortAllChatByPinned([
                    ...allChats.filter((chat) => chat.chatType === targetChatType),
                ])
            );
        }
    }, [showOnlyUnreadItems, allChats]);

    return filteredChats;
};

// Custom hook for managing filtered activity messages
const useFilteredActivityMessages = (
    activityMessages: ActivityMessageProps[],
    currentActivityMessageType: number,
    showOnlyUnreadItems: boolean
) => {
    const [tmpActivityMessages, setTmpActivityMessages] = useState<ActivityMessageProps[]>(
        activityMessages.filter((item) => !(item.isThread === true && item.messageId === 1))
    );

    useEffect(() => {
        const filteredMessages = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );

        if (filteredMessages) {
            const filterFn =
                ACTIVITY_FILTERS[currentActivityMessageType as keyof typeof ACTIVITY_FILTERS];
            const filtered = filterFn ? filteredMessages.filter(filterFn) : filteredMessages;

            if (showOnlyUnreadItems) {
                setTmpActivityMessages(filtered.filter((item) => item.isRead === false));
            } else {
                setTmpActivityMessages(filtered);
            }
        }
    }, [activityMessages, currentActivityMessageType, showOnlyUnreadItems]);

    return tmpActivityMessages;
};

// Empty state component
const EmptyState = ({ chatType }: { chatType: number }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const config = EMPTY_STATES[chatType] || EMPTY_STATES[CHAT_TYPES.DM];
    const Icon = config.icon;

    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                px: 3,
                py: 6,
                animation: "fadeIn 0.4s ease-out",
                "@keyframes fadeIn": {
                    from: { opacity: 0, transform: "translateY(8px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
            }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.06) 100%)"
                        : "linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.04) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(139,92,246,0.12)" : "rgba(124,58,237,0.08)",
                    mb: 2,
                    position: "relative",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: -6,
                        borderRadius: "50%",
                        border: "1px dashed",
                        borderColor: isDark ? "rgba(139,92,246,0.12)" : "rgba(124,58,237,0.1)",
                        animation: "rotate 25s linear infinite",
                    },
                    "@keyframes rotate": {
                        from: { transform: "rotate(0deg)" },
                        to: { transform: "rotate(360deg)" },
                    },
                }}
            >
                <Icon
                    sx={{
                        fontSize: 28,
                        color: isDark ? "#a78bfa" : "#7c3aed",
                        opacity: 0.7,
                    }}
                />
            </Box>

            <Typography
                level="title-sm"
                sx={{
                    fontWeight: 600,
                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                    mb: 0.5,
                    textAlign: "center",
                }}
            >
                {config.title}
            </Typography>
            <Typography
                level="body-xs"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                    textAlign: "center",
                    maxWidth: 180,
                }}
            >
                {config.subtitle}
            </Typography>
        </Box>
    );
};

// Component for rendering chat items
const ChatListRenderer = ({
    targetChats,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
    useTEM,
    useUISM,
    useCM,
    useTM,
    isDark,
}: {
    targetChats: AllChatProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={targetChats.length}
        itemContent={(index) => {
            const chat = targetChats[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <ChatListItem
                        key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                        chat={chat}
                        useCM={useCM}
                        incompleteTodoCount={state.incompleteTodoCount}
                        isPinnedChat={false}
                        myself={data.myself}
                        setIsToDoVisible={actions.setIsToDoVisible}
                        isToDoVisible={state.isToDoVisible}
                        setMyself={data.setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        useTM={useTM}
                    />
                </Box>
            );
        }}
    />
);

// Component for rendering activity messages
const ActivityListRenderer = ({
    tmpActivityMessages,
    activityMessages,
    virtuosoRef,
    data,
    socket,
    selectedActivityId,
    setSelectedActivityId,
    useCM,
    useUISM,
    useTEM,
    useTM,
    usePM,
    isDark,
}: {
    tmpActivityMessages: ActivityMessageProps[];
    activityMessages: ActivityMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    data: ChatListData;
    socket: Socket | null;
    selectedActivityId: string;
    setSelectedActivityId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={tmpActivityMessages.length}
        itemContent={(index) => {
            const activityMessage = tmpActivityMessages[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <Stack direction="row">
                        <ChatListItemForActivity
                            key={`${activityMessage.activityId}-${activityMessage.isRead}`}
                            activity={activityMessage}
                            activityMessages={activityMessages}
                            useCM={useCM}
                            myself={data.myself}
                            selectedActivityId={selectedActivityId}
                            setCurrentProject={usePM.setCurrentProject}
                            setMyself={data.setMyself}
                            setSelectedActivityId={setSelectedActivityId}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                        />
                    </Stack>
                </Box>
            );
        }}
    />
);

// Component for rendering flagged messages
const FlaggedListRenderer = ({
    tmpFlaggedMessages,
    virtuosoRef,
    data,
    socket,
    selectedFlaggedMessageId,
    setSelectedFlaggedMessageId,
    useUISM,
    useTEM,
    useCM,
    useTM,
    usePM,
    isDark,
}: {
    tmpFlaggedMessages: FlaggedMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    data: ChatListData;
    socket: Socket | null;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={tmpFlaggedMessages.length}
        itemContent={(index) => {
            const flaggedMessage = tmpFlaggedMessages[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <Stack direction="row">
                        <ChatListItemForFlagMessages
                            key={`${flaggedMessage.flaggedMessageId}`}
                            useCM={useCM}
                            flaggedMessage={flaggedMessage}
                            myself={data.myself}
                            selectedFlaggedMessageId={selectedFlaggedMessageId}
                            setCurrentProject={usePM.setCurrentProject}
                            setMyself={data.setMyself}
                            setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                        />
                    </Stack>
                </Box>
            );
        }}
    />
);

export const ChatList = (props: ChatListProps) => {
    const {
        socket,
        targetChatType,
        currentActivityMessageType,
        state,
        actions,
        data,
        useUISM,
        useTEM,
        useCM,
        useTM,
        usePM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Refs for different chat types
    const virtuosoDMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoGMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPinnedRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoFlaggedRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoActivityRef = useRef<VirtuosoHandle | null>(null);

    // Chat type lookup for refs
    const chatTypeLookup: { [key: number]: React.RefObject<VirtuosoHandle | null> } = {
        [CHAT_TYPES.DM]: virtuosoDMRef,
        [CHAT_TYPES.GM]: virtuosoGMRef,
        [CHAT_TYPES.PM]: virtuosoPMRef,
        [CHAT_TYPES.PINNED]: virtuosoPinnedRef,
    };

    // Custom hooks for filtered data
    const targetChats = useFilteredChats(
        useCM.allChats,
        targetChatType,
        state.showOnlyUnreadItems
    );
    const tmpActivityMessages = useFilteredActivityMessages(
        useCM.activityMessages,
        currentActivityMessageType,
        state.showOnlyUnreadItems
    );
    const [tmpFlaggedMessages, setTmpFlaggedMessages] = useState<FlaggedMessageProps[]>(
        useCM.flaggedMessages
    );
    const [selectedActivityId, setSelectedActivityId] = useState<string>("");
    const [selectedFlaggedMessageId, setSelectedFlaggedMessageId] = useState<string>("");

    // Scroll hooks
    useScrollToBottomOnChatPaneChange(
        virtuosoDMRef as React.RefObject<VirtuosoHandle>,
        useCM.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoGMRef as React.RefObject<VirtuosoHandle>,
        useCM.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoPMRef as React.RefObject<VirtuosoHandle>,
        useCM.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoPinnedRef as React.RefObject<VirtuosoHandle>,
        useCM.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoFlaggedRef as React.RefObject<VirtuosoHandle>,
        useCM.allChats
    );
    useScrollToBottomOnNewActivity(
        virtuosoActivityRef as React.RefObject<VirtuosoHandle>,
        useCM.activityMessages,
        true
    );

    // Update flagged messages when props change
    useEffect(() => {
        setTmpFlaggedMessages(useCM.flaggedMessages);
    }, [useCM.flaggedMessages]);

    const renderChatList = () => {
        if (targetChatType < CHAT_TYPES.ACTIVITY) {
            if (targetChats.length === 0) {
                return <EmptyState chatType={targetChatType} />;
            }
            const virtuosoRef = chatTypeLookup[targetChatType];
            return (
                <ChatListRenderer
                    actions={actions}
                    isDark={isDark}
                    useCM={useCM}
                    data={data}
                    socket={socket}
                    state={state}
                    useTEM={useTEM}
                    targetChats={targetChats}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoRef}
                    useTM={useTM}
                />
            );
        }
        return null;
    };

    const renderActivityList = () => {
        if (targetChatType === CHAT_TYPES.ACTIVITY) {
            if (tmpActivityMessages.length === 0) {
                return <EmptyState chatType={CHAT_TYPES.ACTIVITY} />;
            }
            return (
                <ActivityListRenderer
                    isDark={isDark}
                    usePM={usePM}
                    activityMessages={useCM.activityMessages}
                    useCM={useCM}
                    data={data}
                    selectedActivityId={selectedActivityId}
                    setSelectedActivityId={setSelectedActivityId}
                    socket={socket}
                    useTEM={useTEM}
                    tmpActivityMessages={tmpActivityMessages}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoActivityRef}
                    useTM={useTM}
                />
            );
        }
        return null;
    };

    const renderFlaggedList = () => {
        if (targetChatType === CHAT_TYPES.FLAGGED) {
            if (tmpFlaggedMessages.length === 0) {
                return <EmptyState chatType={CHAT_TYPES.FLAGGED} />;
            }
            return (
                <FlaggedListRenderer
                    isDark={isDark}
                    usePM={usePM}
                    useCM={useCM}
                    data={data}
                    selectedFlaggedMessageId={selectedFlaggedMessageId}
                    setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                    socket={socket}
                    useTEM={useTEM}
                    tmpFlaggedMessages={tmpFlaggedMessages}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoFlaggedRef}
                    useTM={useTM}
                />
            );
        }
        return null;
    };

    return (
        <List
            className="custom-scrollbar"
            size="sm"
            sx={{
                p: 0,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                "--ListItem-paddingY": "0",
                "--ListItem-paddingX": "0",
            }}
        >
            {renderChatList()}
            {renderActivityList()}
            {renderFlaggedList()}
        </List>
    );
};
