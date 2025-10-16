import { useEffect, useRef, useState } from "react";
import { List, Stack } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { ChatListItemForActivity } from "../activity/chatListItemForActivity";
import { ChatListItemForFlagMessages } from "../activity/chatListItemForFlagMessages";
import {
    useScrollToBottomOnChatPaneChange,
    useScrollToBottomOnNewActivity,
} from "../../hooks/messageBubbleHooks";
import { ChatListItem } from "./chatListItem";

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
    currentMainChat?: ChatProps;
    currentSubChat?: ChatProps;
    isTaskPreviewVisible: boolean;
    isSubChatVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    showOnlyUnreadItems: boolean;
    incompleteTodoCount: number;
}

interface ChatListActions {
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsToDoVisible: (value: boolean) => void;
    funcSetAllChats: () => Promise<void>;
}

interface ChatListData {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    allChats: AllChatProps[];
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
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
    chatType: number;
    currentActivityMessageType: number;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
};

// Custom hook for managing filtered chats
const useFilteredChats = (allChats: AllChatProps[], showOnlyUnreadItems: boolean) => {
    const [tmpAllChats, setTmpAllChats] = useState<AllChatProps[]>(sortAllChatByPinned(allChats));

    useEffect(() => {
        if (showOnlyUnreadItems) {
            const filteredChats = allChats.filter(
                (item) =>
                    item.lastReadMessageId <
                    (item.latestMessage
                        ? item.latestMessage.messageId
                        : item.lastReadMessageId + 1)
            );
            setTmpAllChats(sortAllChatByPinned(filteredChats));
        } else {
            setTmpAllChats(sortAllChatByPinned([...allChats]));
        }
    }, [showOnlyUnreadItems, allChats]);

    return tmpAllChats;
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
    tmpAllChats,
    allChats,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
}: {
    tmpAllChats: AllChatProps[];
    allChats: AllChatProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className="custom-scrollbar"
        initialTopMostItemIndex={0}
        style={{ height: "93dvh" }}
        totalCount={tmpAllChats.length}
        itemContent={(index) => {
            const chat = tmpAllChats[index];
            return (
                <div>
                    <Stack direction="row">
                        <ChatListItem
                            key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                            allChats={allChats}
                            chat={chat}
                            chatType={chat.chatType}
                            currentMainChat={state.currentMainChat}
                            currentSubChat={state.currentSubChat}
                            funcSetAllChats={actions.funcSetAllChats}
                            incompleteTodoCount={state.incompleteTodoCount}
                            isCreatingTask={state.isCreatingTask}
                            isPinnedChat={false}
                            isSubChatVisible={state.isSubChatVisible}
                            isTaskPreviewVisible={state.isTaskPreviewVisible}
                            myself={data.myself}
                            setCurrentMainChat={actions.setCurrentMainChat}
                            setCurrentSubChat={actions.setCurrentSubChat}
                            setIsMainChatVisible={actions.setIsMainChatVisible}
                            setIsSubChatVisible={actions.setIsSubChatVisible}
                            setIsThreadVisible={actions.setIsThreadVisible}
                            setIsToDoVisible={actions.setIsToDoVisible}
                            setMyself={data.setMyself}
                            setOpeningService={actions.setOpeningService}
                            socket={socket}
                            teamMemberProfiles={data.teamMemberProfiles}
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
                            allChats={data.allChats}
                            currentSubChat={state.currentSubChat}
                            funcSetAllChats={actions.funcSetAllChats}
                            isCreatingTask={state.isCreatingTask}
                            isSubChatVisible={state.isSubChatVisible}
                            isTaskPreviewVisible={state.isTaskPreviewVisible}
                            myself={data.myself}
                            selectedActivityId={selectedActivityId}
                            setActivityMessages={data.setActivityMessages}
                            setCurrentMainChat={actions.setCurrentMainChat}
                            setCurrentPreviewTaskId={actions.setCurrentPreviewTaskId}
                            setCurrentProject={actions.setCurrentProject}
                            setCurrentSubChat={actions.setCurrentSubChat}
                            setCurrentThreadChat={actions.setCurrentThreadChat}
                            setIsMainChatVisible={actions.setIsMainChatVisible}
                            setIsTaskPreviewVisible={actions.setIsTaskPreviewVisible}
                            setIsThreadVisible={actions.setIsThreadVisible}
                            setMyself={data.setMyself}
                            setOpeningService={actions.setOpeningService}
                            setSelectedActivityId={setSelectedActivityId}
                            socket={socket}
                            teamMemberProfiles={data.teamMemberProfiles}
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
    flaggedMessages,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
    selectedFlaggedMessageId,
    setSelectedFlaggedMessageId,
}: {
    tmpFlaggedMessages: FlaggedMessageProps[];
    flaggedMessages: FlaggedMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (id: string) => void;
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
                            allChats={data.allChats}
                            currentSubChat={state.currentSubChat}
                            flaggedMessage={flaggedMessage}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={actions.funcSetAllChats}
                            isCreatingTask={state.isCreatingTask}
                            isSubChatVisible={state.isSubChatVisible}
                            isTaskPreviewVisible={state.isTaskPreviewVisible}
                            myself={data.myself}
                            selectedFlaggedMessageId={selectedFlaggedMessageId}
                            setCurrentMainChat={actions.setCurrentMainChat}
                            setCurrentPreviewTaskId={actions.setCurrentPreviewTaskId}
                            setCurrentProject={actions.setCurrentProject}
                            setCurrentSubChat={actions.setCurrentSubChat}
                            setCurrentThreadChat={actions.setCurrentThreadChat}
                            setFlaggedMessages={data.setFlaggedMessages}
                            setIsMainChatVisible={actions.setIsMainChatVisible}
                            setIsTaskPreviewVisible={actions.setIsTaskPreviewVisible}
                            setIsThreadVisible={actions.setIsThreadVisible}
                            setMyself={data.setMyself}
                            setOpeningService={actions.setOpeningService}
                            setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                            socket={socket}
                            teamMemberProfiles={data.teamMemberProfiles}
                        />
                    </Stack>
                </div>
            );
        }}
    />
);

export const ChatList = (props: ChatListProps) => {
    const { socket, chatType, currentActivityMessageType, state, actions, data } = props;

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
    const tmpAllChats = useFilteredChats(data.allChats, state.showOnlyUnreadItems);
    const tmpActivityMessages = useFilteredActivityMessages(
        data.activityMessages,
        currentActivityMessageType,
        state.showOnlyUnreadItems
    );
    const [tmpFlaggedMessages, setTmpFlaggedMessages] = useState<FlaggedMessageProps[]>(
        data.flaggedMessages
    );
    const [selectedActivityId, setSelectedActivityId] = useState<string>("");
    const [selectedFlaggedMessageId, setSelectedFlaggedMessageId] = useState<string>("");

    // Scroll hooks
    useScrollToBottomOnChatPaneChange(
        virtuosoDMRef as React.RefObject<VirtuosoHandle>,
        data.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoGMRef as React.RefObject<VirtuosoHandle>,
        data.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoPMRef as React.RefObject<VirtuosoHandle>,
        data.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoPinnedRef as React.RefObject<VirtuosoHandle>,
        data.allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoFlaggedRef as React.RefObject<VirtuosoHandle>,
        data.allChats
    );
    useScrollToBottomOnNewActivity(
        virtuosoActivityRef as React.RefObject<VirtuosoHandle>,
        data.activityMessages,
        true
    );

    // Update flagged messages when props change
    useEffect(() => {
        setTmpFlaggedMessages(data.flaggedMessages);
    }, [data.flaggedMessages]);

    const renderChatList = () => {
        if (chatType < CHAT_TYPES.ACTIVITY && tmpAllChats.length > 0) {
            const virtuosoRef = chatTypeLookup[chatType];
            return (
                <ChatListRenderer
                    tmpAllChats={tmpAllChats}
                    allChats={data.allChats}
                    virtuosoRef={virtuosoRef}
                    state={state}
                    actions={actions}
                    data={data}
                    socket={socket}
                />
            );
        }
        return null;
    };

    const renderActivityList = () => {
        if (chatType === CHAT_TYPES.ACTIVITY && tmpActivityMessages.length > 0) {
            return (
                <ActivityListRenderer
                    tmpActivityMessages={tmpActivityMessages}
                    activityMessages={data.activityMessages}
                    virtuosoRef={virtuosoActivityRef}
                    state={state}
                    actions={actions}
                    data={data}
                    socket={socket}
                    selectedActivityId={selectedActivityId}
                    setSelectedActivityId={setSelectedActivityId}
                />
            );
        }
        return null;
    };

    const renderFlaggedList = () => {
        if (chatType === CHAT_TYPES.FLAGGED && tmpFlaggedMessages.length > 0) {
            return (
                <FlaggedListRenderer
                    tmpFlaggedMessages={tmpFlaggedMessages}
                    flaggedMessages={data.flaggedMessages}
                    virtuosoRef={virtuosoFlaggedRef}
                    state={state}
                    actions={actions}
                    data={data}
                    socket={socket}
                    selectedFlaggedMessageId={selectedFlaggedMessageId}
                    setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
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
