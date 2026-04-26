import { useCallback, useEffect, useState } from "react";
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
import { calculateVirtuosoSubHight } from "./services/calculateVirtuosoHight";
import { createFileDropHandler } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, ToDoFactProps } from "../../types/chat";
import { ToDoPane } from "./ToDoPane";

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
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
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
        useTM,
    } = props;

    // File drag-and-drop state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    if (!useCM.currentSubChat) {
        return null;
    }

    // Use shared hooks
    const messageManagement = useMessageManagement({ chat: useCM.currentSubChat });
    const readStatusManagement = useReadStatusManagement({
        currentChat: useCM.currentSubChat,
        myself,
        useCM,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: useCM.currentSubChat,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
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
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
    }, [scrollManagement.visibleRange]);

    const virtuosoHeight = calculateVirtuosoSubHight(
        currentWindowHeight,
        paneSizePCT,
        messageManagement.numEditorLines
    );

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Sheet sx={{ backgroundColor: "background.level1" }}>
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <SubChatPaneHeader
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

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId && (
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
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId
                ) &&
                    useCM.currentSubChat &&
                    messageManagement.messages && (
                        <>
                            <MessageListRenderer
                                chat={useCM.currentSubChat}
                                useCM={useCM}
                                currentChatId={currentSubChatId}
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
                            />
                            <ChatEditorSection
                                chat={useCM.currentSubChat as ChatProps | ThreadProps}
                                useCM={useCM}
                                editTargetMessage={messageManagement.editTargetMessage}
                                isInEdit={messageManagement.isInEdit}
                                isThread={false}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                socket={socket}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                pendingFiles={pendingFiles}
                                clearPendingFiles={clearPendingFiles}
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
