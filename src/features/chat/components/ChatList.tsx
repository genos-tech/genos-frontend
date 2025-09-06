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
    chatType: number;
    currentActivityMessageType: number;
    activityMessages: ActivityMessageProps[];
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
    setIsTaskCreationVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isTaskCreationVisible: boolean;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const ChatList = (props: ChatListProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        chatType,
        activityMessages,
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
        setIsTaskCreationVisible,
        isTaskPreviewVisible,
        isTaskCreationVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        setCurrentPreviewTaskId,
        setCurrentProject,
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

    const virtuosoActivityRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewActivity(
        virtuosoActivityRef as React.RefObject<VirtuosoHandle>,
        activityMessages
    );

    const [tmpActivityMessages, setTmpActivityMessages] =
        useState<ActivityMessageProps[]>(activityMessages);

    useEffect(() => {
        // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
        if (currentActivityMessageType === 0) {
            setTmpActivityMessages(activityMessages);
        }
        if (currentActivityMessageType === 1) {
            setTmpActivityMessages(
                activityMessages.filter((item) => item.activityType === 1 && item.chatType !== 4)
            );
        }
        if (currentActivityMessageType === 2) {
            setTmpActivityMessages(
                activityMessages.filter((item) => item.activityType === 1 && item.chatType === 4)
            );
        }
        if (currentActivityMessageType === 3) {
            setTmpActivityMessages(activityMessages.filter((item) => item.activityType === 3));
        }
        if (currentActivityMessageType === 4) {
            setTmpActivityMessages(activityMessages.filter((item) => item.activityType === 2));
        }
    }, [activityMessages, currentActivityMessageType]);

    return (
        <List
            size="sm"
            sx={{
                py: 0,
                "--ListItem-paddingY": "0.3rem",
                "--ListItem-paddingX": "1rem",
                overflowY: "auto",
                overflowX: "hidden",
            }}
            className="custom-scrollbar"
        >
            {allChats.length > 0 && (
                <Virtuoso
                    ref={chatTypeLookup[chatType]}
                    className="custom-scrollbar"
                    style={{ height: "89dvh" }}
                    totalCount={allChats.length}
                    initialTopMostItemIndex={0}
                    atTopThreshold={64}
                    atBottomThreshold={128}
                    itemContent={(index) => {
                        const chat = allChats[index];
                        return (
                            <div>
                                <Stack direction="row">
                                    <ChatListItem
                                        key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        chat={chat}
                                        myself={myself}
                                        currentMainChat={currentMainChat}
                                        currentSubChat={currentSubChat}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        isThreadVisible={isThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        setIsTaskCreationVisible={setIsTaskCreationVisible}
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

            {tmpActivityMessages.length > 0 && (
                <Virtuoso
                    ref={virtuosoActivityRef}
                    className="custom-scrollbar"
                    style={{ height: "85dvh" }}
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
                                        key={activityMessage.activityId}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        activity={activityMessage}
                                        myself={myself}
                                        currentMainChat={currentMainChat}
                                        currentSubChat={currentSubChat}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        isThreadVisible={isThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        setIsTaskCreationVisible={setIsTaskCreationVisible}
                                        isTaskPreviewVisible={isTaskPreviewVisible}
                                        isTaskCreationVisible={isTaskCreationVisible}
                                        isSubChatVisible={isSubChatVisible}
                                        setIsSubChatVisible={setIsSubChatVisible}
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
