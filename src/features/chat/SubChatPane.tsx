import { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { SubChatPaneHeader } from "./components/headers/SubChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { createFileDropHandler } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import {
    ChatProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
    ToDoFactProps,
} from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { ToDoPane } from "./ToDoPane";

const EMPTY_CHAT: ChatProps = {
    chatId: -1,
    chatName: "",
    chatType: 0,
    dmPartnerUser: {
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        avatarImgPath: "",
        tsLastSeen: "",
        tsJoined: "",
    },
    lastReadMessageId: 0,
    messages: [],
    latestMessage: undefined as any,
    latestMessageText: "",
    TSLastMessage: "",
    isPrivate: false,
    profileImagePath: "",
};

type MessagesPaneProps = {
    useTEM: TeamManagementState;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentSubChatId: number;
    usePM: ProjectManagementState;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        useCM,
        currentSubChatId,
        currentWindowHeight,
        incompleteTodoCount,
        isExistingTodaysTodo,
        isToDoVisible,
        myself,
        usePM,
        setIsExistingTodaysTodo,
        setIsToDoVisible,
        setMyself,
        useUISM,
        setTodos,
        socket,
        useTEM,
        todos,
        useTM,
        setTodoFromMessageBubble,
    } = props;

    // File drag-and-drop state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Use a stable placeholder when currentSubChat is null so hooks are always called
    const chatForHooks = useMemo(() => useCM.currentSubChat ?? EMPTY_CHAT, [useCM.currentSubChat]);

    // Use shared hooks (must be called unconditionally)
    const messageManagement = useMessageManagement({ chat: chatForHooks });
    const readStatusManagement = useReadStatusManagement({
        currentChat: chatForHooks,
        myself,
        useCM,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: chatForHooks,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        if (!useCM.currentSubChat) return;
        setTimeout(() => {
            if (useCM.currentSubChat) {
                let targetIndex: number;
                if (useCM.currentSubChat.moveToSpecificIndex === undefined) {
                    targetIndex = useCM.currentSubChat.messages.length - 1;
                } else if (
                    useCM.currentSubChat.moveToSpecificIndex &&
                    messageManagement.indexMap &&
                    messageManagement.indexMap[useCM.currentSubChat.moveToSpecificIndex] &&
                    useCM.currentSubChat.chatId ===
                        Number(useCM.currentSubChat.moveToSpecificIndex?.split("-")[0])
                ) {
                    targetIndex = Number(
                        messageManagement.indexMap[useCM.currentSubChat.moveToSpecificIndex]
                    );
                } else {
                    targetIndex = -1;
                }

                readStatusManagement.handleReadStatusUpdate(targetIndex);
            }
        }, 1000);
    }, [messageManagement.indexMap]);

    useEffect(() => {
        if (!useCM.currentSubChat) return;
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
    }, [scrollManagement.visibleRange]);

    if (!useCM.currentSubChat) {
        return null;
    }

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Sheet
                sx={{
                    backgroundColor: "background.level1",
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <SubChatPaneHeader
                    incompleteTodoCount={incompleteTodoCount}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId && (
                        <ToDoPane
                            currentWindowHeight={currentWindowHeight}
                            isExistingTodaysTodo={isExistingTodaysTodo}
                            myself={myself}
                            setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                            setMyself={setMyself}
                            setTodos={setTodos}
                            socket={socket}
                            todos={todos}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}

                {!(
                    isToDoVisible === true &&
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId
                ) &&
                    useCM.currentSubChat &&
                    messageManagement.messages && (
                        <>
                            <MessageListRenderer
                                chat={useCM.currentSubChat}
                                currentChatId={currentSubChatId}
                                height={0}
                                indexMap={messageManagement.indexMap}
                                isScrolling={scrollManagement.isScrolling}
                                isThread={false}
                                messages={messageManagement.messages}
                                myself={myself}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setErrorMessage={messageManagement.setErrorMessage}
                                setErrorOpen={messageManagement.setErrorOpen}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                setMyself={setMyself}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                socket={socket}
                                useCM={useCM}
                                usePM={usePM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                                visibleRange={scrollManagement.visibleRange}
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                fillContainer
                            />
                            <ChatEditorSection
                                chat={useCM.currentSubChat as ChatProps | ThreadProps}
                                clearPendingFiles={clearPendingFiles}
                                editTargetMessage={messageManagement.editTargetMessage}
                                isInEdit={messageManagement.isInEdit}
                                isThread={false}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                pendingFiles={pendingFiles}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                setCurrentChat={
                                    useCM.setCurrentSubChat as (
                                        chat: ChatProps | ThreadProps
                                    ) => void
                                }
                            />
                        </>
                    )}
            </Sheet>
        </div>
    );
};
