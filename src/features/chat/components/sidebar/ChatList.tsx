import { useEffect, useRef, useState } from "react";
import { List, Stack } from "@mui/joy";
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

// Interfaces for better prop organization
interface ChatListState {
    showOnlyUnreadItems: boolean;
    incompleteTodoCount: number;
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
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className="custom-scrollbar"
        initialTopMostItemIndex={0}
        style={{ height: "93dvh" }}
        totalCount={targetChats.length}
        itemContent={(index) => {
            const chat = targetChats[index];
            return (
                <div>
                    <Stack direction="row">
                        <ChatListItem
                            key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                            chat={chat}
                            useCM={useCM}
                            incompleteTodoCount={state.incompleteTodoCount}
                            isPinnedChat={false}
                            myself={data.myself}
                            setIsToDoVisible={actions.setIsToDoVisible}
                            setMyself={data.setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                        />
                    </Stack>
                </div>
            );
        }}
    />
);

// Component for rendering activity messages
const ActivityListRenderer = ({
    tmpActivityMessages,
    activityMessages,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
    selectedActivityId,
    setSelectedActivityId,
    useCM,
    useUISM,
    useTEM,
    useTM,
    usePM,
}: {
    tmpActivityMessages: ActivityMessageProps[];
    activityMessages: ActivityMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
    selectedActivityId: string;
    setSelectedActivityId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className="custom-scrollbar"
        initialTopMostItemIndex={0}
        style={{ height: "89dvh" }}
        totalCount={tmpActivityMessages.length}
        itemContent={(index) => {
            const activityMessage = tmpActivityMessages[index];
            return (
                <div>
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
                </div>
            );
        }}
    />
);

// Component for rendering flagged messages
const FlaggedListRenderer = ({
    tmpFlaggedMessages,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
    selectedFlaggedMessageId,
    setSelectedFlaggedMessageId,
    useUISM,
    useTEM,
    useCM,
    useTM,
    usePM,
}: {
    tmpFlaggedMessages: FlaggedMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className="custom-scrollbar"
        initialTopMostItemIndex={0}
        style={{ height: "89dvh" }}
        totalCount={tmpFlaggedMessages.length}
        itemContent={(index) => {
            const flaggedMessage = tmpFlaggedMessages[index];
            return (
                <div>
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
                </div>
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
        if (targetChatType < CHAT_TYPES.ACTIVITY && targetChats.length > 0) {
            const virtuosoRef = chatTypeLookup[targetChatType];
            return (
                <ChatListRenderer
                    actions={actions}
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
        if (targetChatType === CHAT_TYPES.ACTIVITY && tmpActivityMessages.length > 0) {
            return (
                <ActivityListRenderer
                    actions={actions}
                    usePM={usePM}
                    activityMessages={useCM.activityMessages}
                    useCM={useCM}
                    data={data}
                    selectedActivityId={selectedActivityId}
                    setSelectedActivityId={setSelectedActivityId}
                    socket={socket}
                    state={state}
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
        if (targetChatType === CHAT_TYPES.FLAGGED && tmpFlaggedMessages.length > 0) {
            return (
                <FlaggedListRenderer
                    actions={actions}
                    usePM={usePM}
                    useCM={useCM}
                    data={data}
                    selectedFlaggedMessageId={selectedFlaggedMessageId}
                    setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                    socket={socket}
                    state={state}
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
                "--ListItem-paddingY": "0.3rem",
                "--ListItem-paddingX": "1rem",
                overflowY: "auto",
                overflowX: "hidden",
            }}
        >
            {renderChatList()}
            {renderActivityList()}
            {renderFlaggedList()}
        </List>
    );
};
