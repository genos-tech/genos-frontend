import { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { List, Stack } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import {
    useScrollToBottomOnChatPaneChange,
    useScrollToBottomOnNewActivity,
} from "../hooks/messageBubbleHooks";
import { ChatListItem } from "./chatListItem";
import { ChatListItemForActivity } from "./chatListItemForActivity";
import { UserProps } from "../../../types/admin";
import { ProjectProps } from "../../../types/tasks";
import {
    ChatProps,
    AllChatProps,
    ActivityMessageProps,
    ThreadProps,
    FlaggedMessageProps,
} from "../../../types/chat";
import { ChatListItemForFlagMessages } from "./chatListItemForFlagMessages";

// Sort all chats by pinned status and then by TSLastMessage in desc
const sortAllChatByPinned = (allChats: AllChatProps[]) => {
    return allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();
    });
};

type ChatListProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chatType: number;
    currentActivityMessageType: number;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
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
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    showOnlyUnreadItems: boolean;
    funcSetAllChats: () => Promise<void>;
    incompleteTodoCount: number;
    setIsToDoVisible: (value: boolean) => void;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
};
export const ChatList = (props: ChatListProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        chatType,
        activityMessages,
        setActivityMessages,
        allChats,
        currentActivityMessageType,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        currentMainChat,
        currentSubChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        setCurrentPreviewTaskId,
        setCurrentProject,
        showOnlyUnreadItems,
        funcSetAllChats,
        incompleteTodoCount,
        setIsToDoVisible,
        flaggedMessages,
        setFlaggedMessages,
    } = props;
    const virtuosoDMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoGMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPinnedRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoFlaggedRef = useRef<VirtuosoHandle | null>(null);

    const chatTypeLookup: { [key: number]: any } = {
        1: virtuosoDMRef, // DM
        2: virtuosoGMRef, // GM
        3: virtuosoPMRef, // PM
        4: virtuosoPinnedRef, // Pinned
    };
    useScrollToBottomOnChatPaneChange(virtuosoDMRef as React.RefObject<VirtuosoHandle>, allChats);
    useScrollToBottomOnChatPaneChange(virtuosoGMRef as React.RefObject<VirtuosoHandle>, allChats);
    useScrollToBottomOnChatPaneChange(virtuosoPMRef as React.RefObject<VirtuosoHandle>, allChats);
    useScrollToBottomOnChatPaneChange(
        virtuosoPinnedRef as React.RefObject<VirtuosoHandle>,
        allChats
    );
    useScrollToBottomOnChatPaneChange(
        virtuosoFlaggedRef as React.RefObject<VirtuosoHandle>,
        allChats
    );

    const [tmpAllChats, setTmpAllChats] = useState<AllChatProps[]>(sortAllChatByPinned(allChats));

    const [selectedActivityId, setSelectedActivityId] = useState<string>("");
    const [selectedFlaggedMessageId, setSelectedFlaggedMessageId] = useState<string>("");

    const virtuosoActivityRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewActivity(
        virtuosoActivityRef as React.RefObject<VirtuosoHandle>,
        activityMessages,
        true
    );

    {
        /* Not displaying the first message in a thread 
                                because it's the same as its parent message */
    }
    const [tmpActivityMessages, setTmpActivityMessages] = useState<ActivityMessageProps[]>(
        activityMessages.filter((item) => !(item.isThread === true && item.messageId === 1))
    );

    useEffect(() => {
        // Exclude the first thread message cause it's actually not a thread message.
        const tmpActivityMessages: ActivityMessageProps[] = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );
        if (tmpActivityMessages) {
            // All activities
            if (currentActivityMessageType === 0) {
                setTmpActivityMessages(tmpActivityMessages);
            }

            // Thread activities
            if (currentActivityMessageType === 1) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter(
                        (item) =>
                            item.activityType === 1 &&
                            item.chatType !== 4 &&
                            item.isThread === true
                    )
                );
            }

            // Task activities (Task Comment)
            if (currentActivityMessageType === 2) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter(
                        (item) => item.activityType === 1 && item.chatType === 4
                    )
                );
            }

            // Mention activities
            if (currentActivityMessageType === 3) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter((item) => item.activityType === 3)
                );
            }

            // Reaction activities
            if (currentActivityMessageType === 4) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter((item) => item.activityType === 2)
                );
            }
        }
    }, [activityMessages, currentActivityMessageType, showOnlyUnreadItems]);

    useEffect(() => {
        if (showOnlyUnreadItems === true) {
            setTmpActivityMessages(tmpActivityMessages.filter((item) => item.isRead === false));
            setTmpAllChats(
                sortAllChatByPinned(
                    allChats.filter(
                        (item) =>
                            item.lastReadMessageId <
                            (item.latestMessage
                                ? item.latestMessage.messageId
                                : item.lastReadMessageId + 1)
                    )
                )
            );
        } else {
            setTmpAllChats(sortAllChatByPinned([...allChats]));
        }
    }, [showOnlyUnreadItems, allChats]);

    const [tmpFlaggedMessages, setTmpFlaggedMessages] =
        useState<FlaggedMessageProps[]>(flaggedMessages);

    useEffect(() => {
        setTmpFlaggedMessages(flaggedMessages);
    }, [flaggedMessages]);

    return (
        <List
            size="sm"
            sx={{
                p: 0,
                "--ListItem-paddingY": "0.3rem",
                "--ListItem-paddingX": "1rem",
                overflowY: "auto",
                overflowX: "hidden",
            }}
            className="custom-scrollbar"
        >
            {chatType < 5 && tmpAllChats.length > 0 && (
                <Virtuoso
                    ref={chatTypeLookup[chatType]}
                    className="custom-scrollbar"
                    style={{ height: "93dvh" }}
                    totalCount={tmpAllChats.length}
                    initialTopMostItemIndex={0}
                    atTopThreshold={64}
                    atBottomThreshold={128}
                    itemContent={(index) => {
                        const chat = tmpAllChats[index];
                        return (
                            <div>
                                <Stack direction="row">
                                    <ChatListItem
                                        key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        chat={chat}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentMainChat={currentMainChat}
                                        currentSubChat={currentSubChat}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isCreatingTask={isCreatingTask}
                                        isSubChatVisible={isSubChatVisible}
                                        setIsSubChatVisible={setIsSubChatVisible}
                                        setOpeningService={setOpeningService}
                                        chatType={chat.chatType}
                                        funcSetAllChats={funcSetAllChats}
                                        allChats={allChats}
                                        isPinnedChat={chatType === 4}
                                        incompleteTodoCount={incompleteTodoCount}
                                        setIsToDoVisible={setIsToDoVisible}
                                    />
                                </Stack>
                            </div>
                        );
                    }}
                />
            )}

            {chatType === 5 && tmpActivityMessages.length > 0 && (
                <Virtuoso
                    ref={virtuosoActivityRef}
                    className="custom-scrollbar"
                    style={{ height: "89dvh" }}
                    totalCount={tmpActivityMessages.length}
                    initialTopMostItemIndex={0}
                    atTopThreshold={64}
                    atBottomThreshold={128}
                    itemContent={(index) => {
                        const activityMessage = tmpActivityMessages[index];
                        return (
                            <div>
                                <Stack direction="row">
                                    <ChatListItemForActivity
                                        key={`${activityMessage.activityId}-${activityMessage.isRead}`}
                                        selectedActivityId={selectedActivityId}
                                        setSelectedActivityId={setSelectedActivityId}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        activity={activityMessage}
                                        activityMessages={activityMessages}
                                        setActivityMessages={setActivityMessages}
                                        myself={myself}
                                        setMyself={setMyself}
                                        allChats={allChats}
                                        currentSubChat={currentSubChat}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isCreatingTask={isCreatingTask}
                                        isSubChatVisible={isSubChatVisible}
                                        setOpeningService={setOpeningService}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        setCurrentProject={setCurrentProject}
                                        funcSetAllChats={funcSetAllChats}
                                    />
                                </Stack>
                            </div>
                        );
                    }}
                />
            )}

            {chatType === 6 && tmpFlaggedMessages.length > 0 && (
                <Virtuoso
                    ref={virtuosoFlaggedRef}
                    className="custom-scrollbar"
                    style={{ height: "89dvh" }}
                    totalCount={tmpFlaggedMessages.length}
                    initialTopMostItemIndex={0}
                    atTopThreshold={64}
                    atBottomThreshold={128}
                    itemContent={(index) => {
                        const flaggedMessage = tmpFlaggedMessages[index];
                        return (
                            <div>
                                <Stack direction="row">
                                    <ChatListItemForFlagMessages
                                        key={`${flaggedMessage.flaggedMessageId}`}
                                        selectedFlaggedMessageId={selectedFlaggedMessageId}
                                        setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        flaggedMessage={flaggedMessage}
                                        flaggedMessages={flaggedMessages}
                                        setFlaggedMessages={setFlaggedMessages}
                                        myself={myself}
                                        setMyself={setMyself}
                                        allChats={allChats}
                                        currentSubChat={currentSubChat}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isCreatingTask={isCreatingTask}
                                        isSubChatVisible={isSubChatVisible}
                                        setOpeningService={setOpeningService}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        setCurrentProject={setCurrentProject}
                                        funcSetAllChats={funcSetAllChats}
                                    />
                                </Stack>
                            </div>
                        );
                    }}
                />
            )}
        </List>
    );
};
