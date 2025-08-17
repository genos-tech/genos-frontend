import { Socket } from "socket.io-client";
import { useRef } from "react";
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
    socket: Socket | null;
    myself: UserProps;
    isDm: boolean;
    chatType: number;
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
        socket,
        myself,
        isDm,
        chatType,
        activityMessages,
        allChats,
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

    return (
        <List
            size="sm"
            sx={{
                py: 0,
                "--ListItem-paddingY": "0.3rem",
                "--ListItem-paddingX": "1rem",
                maxHeight: "40vh",
                overflowY: "auto",
                overflowX: "hidden",
            }}
            className="custom-scrollbar"
        >
            <Virtuoso
                ref={chatTypeLookup[chatType]}
                className="custom-scrollbar"
                style={{ height: Math.min(300, 80 * allChats.length) }}
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
                                    key={`${chat.chatId}-${chat.isDm}-${chat.chatName}`}
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

            <Virtuoso
                ref={virtuosoActivityRef}
                className="custom-scrollbar"
                style={{ height: Math.min(800, 80 * activityMessages.length) }}
                totalCount={activityMessages.length}
                initialTopMostItemIndex={0}
                atTopThreshold={64}
                atBottomThreshold={128}
                itemContent={(index) => {
                    const activityMessage = activityMessages[index];
                    return (
                        <div>
                            <Stack direction="row">
                                <ChatListItemForActivity
                                    key={activityMessage.activityId}
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
        </List>
    );
};
