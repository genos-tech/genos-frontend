import { useEffect } from "react";
import { Box, Sheet } from "@mui/joy";
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
import { handleFileDrop } from "./services/handleFileDrop";

import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, ThreadProps, ToDoFactProps } from "../../types/chat";
import { ProjectProps, TaskProps } from "../../types/tasks";
import { ToDoPane } from "./ToDoPane";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamMembers: UserProps[];
    chat?: ChatProps;
    subChat?: ChatProps;
    socket: Socket | null;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentSubChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    isThreadVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    currentSubChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
    showOnlyInCompleteTodos: boolean;
    setShowOnlyInCompleteTodos: (value: boolean) => void;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        teamMemberProfiles,
        currentWindowHeight,
        paneSizePCT,
        myself,
        setMyself,
        teamMembers,
        chat,
        subChat,
        socket,
        setCurrentMainChat,
        setCurrentSubChat,
        currentSubChat,
        currentThreadChat,
        setCurrentThreadChat,
        isThreadVisible,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        currentSubChatId,
        setCurrentPreviewTask,
        setOpeningService,
        funcSetAllChats,
        setCurrentPreviewTaskId,
        setCurrentProject,
        isToDoVisible,
        setIsToDoVisible,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
        flaggedMessages,
        setFlaggedMessages,
        showOnlyInCompleteTodos,
        setShowOnlyInCompleteTodos,
    } = props;

    if (!currentSubChat) {
        return null;
    }

    // Use shared hooks
    const messageManagement = useMessageManagement({ chat: currentSubChat });
    const readStatusManagement = useReadStatusManagement({
        currentChat: currentSubChat,
        myself,
        funcSetAllChats,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: currentSubChat,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            let targetIndex: number;
            if (currentSubChat.moveToSpecificIndex === undefined) {
                targetIndex = currentSubChat.messages.length - 1;
            } else if (
                currentSubChat.moveToSpecificIndex &&
                messageManagement.indexMap &&
                messageManagement.indexMap[currentSubChat.moveToSpecificIndex] &&
                currentSubChat.chatId === Number(currentSubChat.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(
                    messageManagement.indexMap[currentSubChat.moveToSpecificIndex]
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
            onDrop={handleFileDrop}
        >
            <Sheet sx={{ backgroundColor: "background.level1" }}>
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <SubChatPaneHeader
                    chat={chat}
                    funcSetAllChats={funcSetAllChats}
                    incompleteTodoCount={incompleteTodoCount}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    setIsCreatingTask={setIsCreatingTask}
                    setIsMainChatVisible={setIsMainChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                    setIsThreadVisible={setIsThreadVisible}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    subChat={subChat}
                    teamMemberProfiles={teamMemberProfiles}
                />

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    currentSubChat.chatType === 1 &&
                    currentSubChat.dmPartnerUser.userId === myself.userId && (
                        <ToDoPane
                            currentWindowHeight={currentWindowHeight}
                            isExistingTodaysTodo={isExistingTodaysTodo}
                            isSubChatVisible={true}
                            myself={myself}
                            setCurrentChat={setCurrentMainChat}
                            setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            setTodos={setTodos}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                            teamMembers={teamMembers}
                            todos={todos}
                            showOnlyInCompleteTodos={showOnlyInCompleteTodos}
                            setShowOnlyInCompleteTodos={setShowOnlyInCompleteTodos}
                        />
                    )}

                {!(
                    isToDoVisible === true &&
                    currentSubChat.chatType === 1 &&
                    currentSubChat.dmPartnerUser.userId === myself.userId
                ) &&
                    chat &&
                    subChat &&
                    messageManagement.messages && (
                        <>
                            <MessageListRenderer
                                chat={subChat}
                                currentChatId={currentSubChatId}
                                currentThreadChat={currentThreadChat}
                                flaggedMessages={flaggedMessages}
                                height={virtuosoHeight}
                                indexMap={messageManagement.indexMap}
                                isCreatingTask={isCreatingTask}
                                isScrolling={scrollManagement.isScrolling}
                                isThread={false}
                                isThreadVisible={isThreadVisible}
                                messages={messageManagement.messages}
                                moveToSpecificIndex={currentSubChat.moveToSpecificIndex}
                                myself={myself}
                                notMove={currentSubChat.notMove}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentPreviewTask={setCurrentPreviewTask}
                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                setCurrentProject={setCurrentProject}
                                setCurrentThreadChat={setCurrentThreadChat}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setErrorMessage={messageManagement.setErrorMessage}
                                setErrorOpen={messageManagement.setErrorOpen}
                                setFlaggedMessages={setFlaggedMessages}
                                setIsCreatingTask={setIsCreatingTask}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setIsMainChatVisible={setIsMainChatVisible}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                setIsThreadVisible={setIsThreadVisible}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                socket={socket}
                                teamMemberProfiles={teamMemberProfiles}
                                visibleRange={scrollManagement.visibleRange}
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                            />
                            <ChatEditorSection
                                chat={chat}
                                editTargetMessage={messageManagement.editTargetMessage}
                                funcSetAllChats={funcSetAllChats}
                                isInEdit={messageManagement.isInEdit}
                                isSubChatVisible={true}
                                isThread={false}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                setOpeningService={setOpeningService}
                                socket={socket}
                                teamMemberProfiles={teamMemberProfiles}
                                teamMembers={teamMembers}
                                setCurrentChat={
                                    setCurrentSubChat as (chat: ChatProps | ThreadProps) => void
                                }
                            />
                        </>
                    )}
            </Sheet>
        </div>
    );
};
