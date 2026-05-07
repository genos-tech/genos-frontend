import { useCallback, useEffect, useState } from "react";
import { Box, Sheet, useColorScheme } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { MainChatPaneHeader } from "./components/headers/MainChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import {
    calculateVirtuosoHight,
    calculateVirtuosoSubHight,
} from "./services/calculateVirtuosoHight";
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

type MessagesPaneProps = {
    useTEM: TeamManagementState;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    currentMainChatId: number;
    usePM: ProjectManagementState;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const MessagesPane = (props: MessagesPaneProps) => {
    const {
        currentMainChatId,
        currentWindowHeight,
        incompleteTodoCount,
        isExistingTodaysTodo,
        isToDoVisible,
        myself,
        paneSizePCT,
        usePM,
        setIsExistingTodaysTodo,
        setIsToDoVisible,
        setMyself,
        useUISM,
        setTodos,
        socket,
        useTEM,
        todos,
        useCM,
        useTM,
        setTodoFromMessageBubble,
    } = props;

    const { mode } = useColorScheme();

    // File drag-and-drop state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Use shared hooks
    const messageManagement = useMessageManagement({
        chat: useCM.currentMainChat as ChatProps | ThreadProps,
    });
    const readStatusManagement = useReadStatusManagement({
        currentChat: useCM.currentMainChat as ChatProps | ThreadProps,
        myself,
        useCM,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: useCM.currentMainChat as ChatProps | ThreadProps,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            let targetIndex: number;
            if (useCM.currentMainChat?.moveToSpecificIndex === undefined) {
                targetIndex = useCM.currentMainChat?.messages?.length
                    ? useCM.currentMainChat?.messages?.length - 1
                    : 0;
            } else if (
                messageManagement.indexMap &&
                messageManagement.indexMap[useCM.currentMainChat?.moveToSpecificIndex] &&
                useCM.currentMainChat?.chatId ===
                    Number(useCM.currentMainChat?.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(
                    messageManagement.indexMap[useCM.currentMainChat?.moveToSpecificIndex]
                );
            } else {
                targetIndex = -1;
            }

            readStatusManagement.handleReadStatusUpdate(targetIndex);
        }, 1000);
    }, [messageManagement.indexMap]);

    useEffect(() => {
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
    }, [scrollManagement.visibleRange]);

    useEffect(() => {
        setTimeout(() => {
            if (useCM.currentMainChat?.latestMessage) {
                readStatusManagement.updateReadStatus(
                    useCM.currentMainChat?.latestMessage.messageId
                );
            }
        }, 300);
    }, [useCM.currentMainChat]);

    const virtuosoHeight =
        useCM.currentMainChat?.chatType === 3
            ? 0.95 * window.innerHeight
            : useCM.isSubChatVisible
              ? calculateVirtuosoSubHight(
                    currentWindowHeight,
                    paneSizePCT,
                    messageManagement.numEditorLines
                )
              : calculateVirtuosoHight(currentWindowHeight, messageManagement.numEditorLines);

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Sheet sx={{ backgroundColor: "background.surface" }}>
                <Box
                    sx={{
                        height: "100%",
                        width: "100%",
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                    }}
                >
                    <ErrorSnackbar
                        errorMessage={messageManagement.errorMessage}
                        errorOpen={messageManagement.errorOpen}
                        setErrorOpen={messageManagement.setErrorOpen}
                    />

                    {useCM.currentMainChat && (
                        <MainChatPaneHeader
                            chat={useCM.currentMainChat}
                            useCM={useCM}
                            incompleteTodoCount={incompleteTodoCount}
                            isToDoVisible={isToDoVisible}
                            myself={myself}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                        />
                    )}

                    {/* To-Do Pane for only myself */}
                    {isToDoVisible === true &&
                        useCM.currentMainChat?.chatType === 1 &&
                        useCM.currentMainChat?.dmPartnerUser.userId === myself.userId && (
                            <ToDoPane
                                useCM={useCM}
                                currentWindowHeight={currentWindowHeight}
                                isExistingTodaysTodo={isExistingTodaysTodo}
                                myself={myself}
                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                setMyself={setMyself}
                                setTodos={setTodos}
                                socket={socket}
                                useTEM={useTEM}
                                todos={todos}
                                useUISM={useUISM}
                            />
                        )}

                    {!(
                        isToDoVisible === true &&
                        useCM.currentMainChat?.chatType === 1 &&
                        useCM.currentMainChat?.dmPartnerUser.userId === myself.userId
                    ) && (
                        <>
                            <MessageListRenderer
                                chat={useCM.currentMainChat as ChatProps | ThreadProps}
                                useCM={useCM}
                                currentChatId={currentMainChatId}
                                height={virtuosoHeight}
                                indexMap={messageManagement.indexMap}
                                isScrolling={scrollManagement.isScrolling}
                                isThread={false}
                                messages={messageManagement.messages}
                                myself={myself}
                                usePM={usePM}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setErrorMessage={messageManagement.setErrorMessage}
                                setErrorOpen={messageManagement.setErrorOpen}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                setMyself={setMyself}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                socket={socket}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                visibleRange={scrollManagement.visibleRange}
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                useTM={useTM}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                            />

                            {useCM.currentMainChat?.chatType !== 3 && (
                                <ChatEditorSection
                                    chat={useCM.currentMainChat as ChatProps | ThreadProps}
                                    useCM={useCM}
                                    editTargetMessage={messageManagement.editTargetMessage}
                                    isInEdit={messageManagement.isInEdit}
                                    isThread={false}
                                    myself={myself}
                                    numEditorLines={messageManagement.numEditorLines}
                                    setCurrentThreadChat={undefined}
                                    setIsInEdit={messageManagement.setIsInEdit}
                                    setMyself={setMyself}
                                    setNumEditorLines={messageManagement.setNumEditorLines}
                                    socket={socket}
                                    useTEM={useTEM}
                                    thread={undefined}
                                    useUISM={useUISM}
                                    pendingFiles={pendingFiles}
                                    clearPendingFiles={clearPendingFiles}
                                    setCurrentChat={
                                        useCM.setCurrentMainChat as (
                                            chat: ChatProps | ThreadProps
                                        ) => void
                                    }
                                />
                            )}
                        </>
                    )}
                </Box>
            </Sheet>
        </div>
    );
};
