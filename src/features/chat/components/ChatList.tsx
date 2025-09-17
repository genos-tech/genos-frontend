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
import { ChatProps, AllChatProps, ActivityMessageProps, ThreadProps } from "../../../types/chat";

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
    isThreadVisible: boolean;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isTaskCreationVisible: boolean;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    onlyUnread: boolean;
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
        isThreadVisible,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
        isTaskCreationVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        setCurrentPreviewTaskId,
        setCurrentProject,
        onlyUnread,
    } = props;
    const virtuosoDMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoGMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPMRef = useRef<VirtuosoHandle | null>(null);

    const chatTypeLookup: { [key: number]: any } = {
        1: virtuosoDMRef,
        2: virtuosoGMRef,
        3: virtuosoPMRef,
    };
    useScrollToBottomOnChatPaneChange(virtuosoDMRef as React.RefObject<VirtuosoHandle>, allChats);
    useScrollToBottomOnChatPaneChange(virtuosoGMRef as React.RefObject<VirtuosoHandle>, allChats);
    useScrollToBottomOnChatPaneChange(virtuosoPMRef as React.RefObject<VirtuosoHandle>, allChats);

    const [tmpAllChats, setTmpAllChats] = useState<AllChatProps[]>(allChats);

    const [selectedActivityId, setSelectedActivityId] = useState<string>("");

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
            // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
            if (currentActivityMessageType === 0) {
                setTmpActivityMessages(tmpActivityMessages);
            }
            if (currentActivityMessageType === 1) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter(
                        (item) => item.activityType === 1 && item.chatType !== 4
                    )
                );
            }
            if (currentActivityMessageType === 2) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter(
                        (item) => item.activityType === 1 && item.chatType === 4
                    )
                );
            }
            if (currentActivityMessageType === 3) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter((item) => item.activityType === 3)
                );
            }
            if (currentActivityMessageType === 4) {
                setTmpActivityMessages(
                    tmpActivityMessages.filter((item) => item.activityType === 2)
                );
            }
        }
    }, [activityMessages, currentActivityMessageType, onlyUnread]);

    useEffect(() => {
        if (onlyUnread === true) {
            setTmpActivityMessages(tmpActivityMessages.filter((item) => item.isRead === false));
            setTmpAllChats(
                allChats.filter(
                    (item) =>
                        item.lastReadMessageId <
                        (item.latestMessage
                            ? item.latestMessage.messageId
                            : item.lastReadMessageId + 1)
                )
            );
        } else {
            setTmpAllChats([...allChats]);
        }
    }, [onlyUnread, allChats]);

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
            {chatType !== -1 && tmpAllChats.length > 0 && (
                <Virtuoso
                    ref={chatTypeLookup[chatType]}
                    className="custom-scrollbar"
                    style={{ height: "87dvh" }}
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
                                        isThreadVisible={isThreadVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isTaskCreationVisible={isTaskCreationVisible}
                                        isSubChatVisible={isSubChatVisible}
                                        setIsSubChatVisible={setIsSubChatVisible}
                                        setOpeningService={setOpeningService}
                                        chatType={chatType}
                                    />
                                </Stack>
                            </div>
                        );
                    }}
                />
            )}

            {chatType === -1 && tmpActivityMessages.length > 0 && (
                <Virtuoso
                    ref={virtuosoActivityRef}
                    className="custom-scrollbar"
                    style={{ height: "83dvh" }}
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
                                        activityMessages={tmpActivityMessages}
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
                                        isThreadVisible={isThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isTaskCreationVisible={isTaskCreationVisible}
                                        isSubChatVisible={isSubChatVisible}
                                        setOpeningService={setOpeningService}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        setCurrentProject={setCurrentProject}
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
