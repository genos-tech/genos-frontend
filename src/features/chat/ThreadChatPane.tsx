import { useEffect } from "react";
import { Box, Sheet } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ThreadChatPaneHeader } from "./components/headers/ThreadChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { calculateVirtuosoHight } from "./services/calculateVirtuosoHight";
import { handleFileDrop } from "./services/handleFileDrop";

import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, ThreadProps } from "../../types/chat";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    thread: ThreadProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamMembers: UserProps[];
    socket: Socket | null;
    currentThreadChat: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsThreadVisible: (value: boolean) => void;
    currentThreadChatId: number;
    setIsMainChatVisible: (value: boolean) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    isChatNoteVisibleInChat: boolean;
    setIsChatNoteVisibleInChat: (value: boolean) => void;
    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
    TM: TaskManagementState;
};

export const ThreadPane = (props: MessagesPaneProps) => {
    const {
        teamMemberProfiles,
        currentWindowHeight,
        thread,
        myself,
        setMyself,
        teamMembers,
        socket,
        currentThreadChat,
        setCurrentThreadChat,
        setIsThreadVisible,
        currentThreadChatId,
        setIsMainChatVisible,
        setOpeningService,
        setCurrentMainChat,
        isChatNoteVisibleInChat,
        setIsChatNoteVisibleInChat,
        handleCreateNewChatNoteIfNotExist,
        flaggedMessages,
        setFlaggedMessages,
        TM,
    } = props;

    // Use shared hooks
    const messageManagement = useMessageManagement({ chat: currentThreadChat, isThread: true });
    const readStatusManagement = useReadStatusManagement({
        currentChat: currentThreadChat,
        myself,
        funcSetAllChats: async () => {}, // Thread doesn't need this
        isThread: true,
    });
    const scrollManagement = useScrollManagement({
        currentChat: currentThreadChat,
        indexMap: messageManagement.indexMap,
        isThread: true,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            let targetIndex: number;
            if (currentThreadChat.moveToSpecificIndex === undefined) {
                targetIndex = currentThreadChat.messages.length - 1;
            } else if (
                messageManagement.indexMap &&
                messageManagement.indexMap[currentThreadChat.moveToSpecificIndex] &&
                currentThreadChat.chatId ===
                    Number(currentThreadChat.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(
                    messageManagement.indexMap[currentThreadChat.moveToSpecificIndex]
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

    const virtuosoHeight = calculateVirtuosoHight(
        currentWindowHeight,
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
            <Sheet
                sx={{
                    height: { xs: "calc(100dvh - var(--Header-height))", md: "100dvh" },
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "background.body",
                }}
            >
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <ThreadChatPaneHeader
                    handleCreateNewChatNoteIfNotExist={handleCreateNewChatNoteIfNotExist}
                    isChatNoteVisibleInChat={isChatNoteVisibleInChat}
                    myself={myself}
                    setCurrentThreadChat={setCurrentThreadChat}
                    setIsChatNoteVisibleInChat={setIsChatNoteVisibleInChat}
                    setIsMainChatVisible={setIsMainChatVisible}
                    setIsThreadVisible={setIsThreadVisible}
                    thread={thread}
                    TM={TM}
                />

                <MessageListRenderer
                    virtuosoRef={scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>}
                    messages={messageManagement.messages}
                    chat={currentThreadChat}
                    myself={myself}
                    teamMemberProfiles={teamMemberProfiles}
                    socket={socket}
                    currentChatId={currentThreadChatId}
                    visibleRange={scrollManagement.visibleRange}
                    setVisibleRange={scrollManagement.setVisibleRange}
                    isScrolling={scrollManagement.isScrolling}
                    setIsScrolling={scrollManagement.setIsScrolling}
                    indexMap={messageManagement.indexMap}
                    moveToSpecificIndex={currentThreadChat.moveToSpecificIndex}
                    notMove={currentThreadChat.notMove}
                    setErrorMessage={messageManagement.setErrorMessage}
                    setErrorOpen={messageManagement.setErrorOpen}
                    flaggedMessages={flaggedMessages}
                    setFlaggedMessages={setFlaggedMessages}
                    isCreatingTask={{ flag: false, parentTaskId: null, rootTaskId: null }}
                    setIsCreatingTask={() => {}}
                    setCurrentPreviewTask={() => {}}
                    setCurrentPreviewTaskId={() => {}}
                    setIsTaskPreviewVisible={() => {}}
                    setCurrentProject={() => {}}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentThreadChat={setCurrentThreadChat}
                    setIsMainChatVisible={setIsMainChatVisible}
                    setIsThreadVisible={setIsThreadVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setEditTargetMessage={messageManagement.setEditTargetMessage}
                    setIsInEdit={messageManagement.setIsInEdit}
                    currentThreadChat={currentThreadChat}
                    isThreadVisible={true}
                    isThread={true}
                    height={virtuosoHeight}
                />

                <ChatEditorSection
                    isInEdit={messageManagement.isInEdit}
                    editTargetMessage={messageManagement.editTargetMessage}
                    chat={currentThreadChat}
                    myself={myself}
                    numEditorLines={messageManagement.numEditorLines}
                    setCurrentChat={setCurrentMainChat as (chat: ChatProps | ThreadProps) => void}
                    setIsInEdit={messageManagement.setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={messageManagement.setNumEditorLines}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
                    teamMembers={teamMembers}
                    isThread={true}
                    thread={thread}
                    setCurrentThreadChat={setCurrentThreadChat}
                    setTargetMessageIndex={() => {}}
                />
            </Sheet>
        </div>
    );
};
