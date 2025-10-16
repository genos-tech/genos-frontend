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
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                messages={messageManagement.messages}
                                chat={subChat}
                                myself={myself}
                                teamMemberProfiles={teamMemberProfiles}
                                socket={socket}
                                currentChatId={currentSubChatId}
                                visibleRange={scrollManagement.visibleRange}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                isScrolling={scrollManagement.isScrolling}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                indexMap={messageManagement.indexMap}
                                moveToSpecificIndex={currentSubChat.moveToSpecificIndex}
                                notMove={currentSubChat.notMove}
                                setErrorMessage={messageManagement.setErrorMessage}
                                setErrorOpen={messageManagement.setErrorOpen}
                                flaggedMessages={flaggedMessages}
                                setFlaggedMessages={setFlaggedMessages}
                                isCreatingTask={isCreatingTask}
                                setIsCreatingTask={setIsCreatingTask}
                                setCurrentPreviewTask={setCurrentPreviewTask}
                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                setCurrentProject={setCurrentProject}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentThreadChat={setCurrentThreadChat}
                                setIsMainChatVisible={setIsMainChatVisible}
                                setIsThreadVisible={setIsThreadVisible}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setIsInEdit={messageManagement.setIsInEdit}
                                currentThreadChat={currentThreadChat}
                                isThreadVisible={isThreadVisible}
                                isThread={false}
                                height={virtuosoHeight}
                            />
                            <ChatEditorSection
                                isInEdit={messageManagement.isInEdit}
                                editTargetMessage={messageManagement.editTargetMessage}
                                chat={chat}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                setCurrentChat={
                                    setCurrentSubChat as (chat: ChatProps | ThreadProps) => void
                                }
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                setOpeningService={setOpeningService}
                                socket={socket}
                                teamMemberProfiles={teamMemberProfiles}
                                teamMembers={teamMembers}
                                funcSetAllChats={funcSetAllChats}
                                isSubChatVisible={true}
                                isThread={false}
                            />
                        </>
                    )}
            </Sheet>
        </div>
    );
};
