import { useEffect } from "react";
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
import { handleFileDrop } from "./services/handleFileDrop";

import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, ThreadProps, ToDoFactProps } from "../../types/chat";
import { ProjectProps, TaskProps } from "../../types/tasks";
import { ToDoPane } from "./ToDoPane";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    paneSizePCT: number;
    chat: ChatProps;
    subChat: ChatProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamMembers: UserProps[];
    socket: Socket | null;
    currentMainChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    isThreadVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
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
    setIsTaskPreviewVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    currentMainChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
};

export const MessagesPane = (props: MessagesPaneProps) => {
    const {
        teamMemberProfiles,
        currentWindowHeight,
        paneSizePCT,
        chat,
        subChat,
        myself,
        setMyself,
        teamMembers,
        socket,
        currentMainChat,
        setCurrentMainChat,
        setCurrentSubChat,
        currentThreadChat,
        setCurrentThreadChat,
        isThreadVisible,
        setIsMainChatVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        setIsThreadVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        currentMainChatId,
        setCurrentPreviewTask,
        setOpeningService,
        funcSetAllChats,
        setCurrentPreviewTaskId,
        setCurrentProject,
        setIsToDoVisible,
        isToDoVisible,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
        flaggedMessages,
        setFlaggedMessages,
    } = props;

    const { mode } = useColorScheme();

    // Use shared hooks
    const messageManagement = useMessageManagement({ chat: currentMainChat });
    const readStatusManagement = useReadStatusManagement({
        currentChat: currentMainChat,
        myself,
        funcSetAllChats,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: currentMainChat,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            let targetIndex: number;
            if (currentMainChat.moveToSpecificIndex === undefined) {
                targetIndex = currentMainChat.messages.length - 1;
            } else if (
                messageManagement.indexMap &&
                messageManagement.indexMap[currentMainChat.moveToSpecificIndex] &&
                currentMainChat.chatId ===
                    Number(currentMainChat.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(
                    messageManagement.indexMap[currentMainChat.moveToSpecificIndex]
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
            if (currentMainChat.latestMessage) {
                readStatusManagement.updateReadStatus(currentMainChat.latestMessage.messageId);
            }
        }, 300);
    }, [currentMainChat]);

    const virtuosoHeight =
        currentMainChat.chatType === 3 || currentMainChat.chatType === 4
            ? 0.95 * window.innerHeight
            : isSubChatVisible
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
            onDrop={handleFileDrop}
        >
            <Sheet sx={{ backgroundColor: "background.surface" }}>
                <Box
                    sx={{
                        height: "100%",
                        width: "100%",
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <ErrorSnackbar
                        errorMessage={messageManagement.errorMessage}
                        errorOpen={messageManagement.errorOpen}
                        setErrorOpen={messageManagement.setErrorOpen}
                    />

                    <MainChatPaneHeader
                        chat={chat}
                        funcSetAllChats={funcSetAllChats}
                        incompleteTodoCount={incompleteTodoCount}
                        isSubChatVisible={isSubChatVisible}
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
                        currentMainChat.chatType === 1 &&
                        currentMainChat.dmPartnerUser.userId === myself.userId && (
                            <ToDoPane
                                currentWindowHeight={currentWindowHeight}
                                isExistingTodaysTodo={isExistingTodaysTodo}
                                isSubChatVisible={isSubChatVisible}
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
                        currentMainChat.chatType === 1 &&
                        currentMainChat.dmPartnerUser.userId === myself.userId
                    ) && (
                        <>
                            <MessageListRenderer
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                messages={messageManagement.messages}
                                chat={chat}
                                myself={myself}
                                teamMemberProfiles={teamMemberProfiles}
                                socket={socket}
                                currentChatId={currentMainChatId}
                                visibleRange={scrollManagement.visibleRange}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                isScrolling={scrollManagement.isScrolling}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                indexMap={messageManagement.indexMap}
                                moveToSpecificIndex={currentMainChat.moveToSpecificIndex}
                                notMove={currentMainChat.notMove}
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

                            {currentMainChat.chatType !== 3 && currentMainChat.chatType !== 4 && (
                                <ChatEditorSection
                                    isInEdit={messageManagement.isInEdit}
                                    editTargetMessage={messageManagement.editTargetMessage}
                                    chat={chat}
                                    myself={myself}
                                    numEditorLines={messageManagement.numEditorLines}
                                    setCurrentChat={
                                        setCurrentMainChat as (
                                            chat: ChatProps | ThreadProps
                                        ) => void
                                    }
                                    setIsInEdit={messageManagement.setIsInEdit}
                                    setMyself={setMyself}
                                    setNumEditorLines={messageManagement.setNumEditorLines}
                                    setOpeningService={setOpeningService}
                                    socket={socket}
                                    teamMemberProfiles={teamMemberProfiles}
                                    teamMembers={teamMembers}
                                    funcSetAllChats={funcSetAllChats}
                                    isSubChatVisible={isSubChatVisible}
                                    isThread={false}
                                />
                            )}
                        </>
                    )}
                </Box>
            </Sheet>
        </div>
    );
};
