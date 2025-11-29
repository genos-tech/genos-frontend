import { useEffect } from "react";
import { Sheet } from "@mui/joy";
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

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps } from "../../types/chat";

type MessagesPaneProps = {
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    currentWindowHeight: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentThreadChatId: number;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
};

export const ThreadPane = (props: MessagesPaneProps) => {
    const {
        useTEM,
        usePM,
        currentWindowHeight,
        myself,
        setMyself,
        socket,
        currentThreadChatId,
        useUISM,
        useTM,
        useCM,
        useNM,
    } = props;

    // Use shared hooks
    const messageManagement = useMessageManagement({
        chat: useCM.currentThreadChat as ThreadProps,
        isThread: true,
    });
    const readStatusManagement = useReadStatusManagement({
        currentChat: useCM.currentThreadChat as ThreadProps,
        myself,
        useCM,
        isThread: true,
    });
    const scrollManagement = useScrollManagement({
        currentChat: useCM.currentThreadChat as ThreadProps,
        indexMap: messageManagement.indexMap,
        isThread: true,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            if (useCM.currentThreadChat) {
                let targetIndex: number;
                if (useCM.currentThreadChat?.moveToSpecificIndex === undefined) {
                    targetIndex = useCM.currentThreadChat?.messages.length - 1;
                } else if (
                    messageManagement.indexMap &&
                    messageManagement.indexMap[useCM.currentThreadChat?.moveToSpecificIndex] &&
                    useCM.currentThreadChat?.chatId ===
                        Number(useCM.currentThreadChat?.moveToSpecificIndex?.split("-")[0])
                ) {
                    targetIndex = Number(
                        messageManagement.indexMap[useCM.currentThreadChat?.moveToSpecificIndex]
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

                <ThreadChatPaneHeader useCM={useCM} useNM={useNM} myself={myself} useTM={useTM} />

                <MessageListRenderer
                    chat={useCM.currentThreadChat as ThreadProps}
                    useCM={useCM}
                    currentChatId={currentThreadChatId}
                    height={virtuosoHeight}
                    indexMap={messageManagement.indexMap}
                    isScrolling={scrollManagement.isScrolling}
                    isThread={true}
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
                    virtuosoRef={scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>}
                    visibleRange={scrollManagement.visibleRange}
                    useTM={useTM}
                />

                <ChatEditorSection
                    chat={useCM.currentThreadChat as ThreadProps}
                    useCM={useCM}
                    editTargetMessage={messageManagement.editTargetMessage}
                    isInEdit={messageManagement.isInEdit}
                    isThread={true}
                    myself={myself}
                    numEditorLines={messageManagement.numEditorLines}
                    setCurrentThreadChat={
                        useCM.setCurrentThreadChat as (chat: ThreadProps) => void
                    }
                    setIsInEdit={messageManagement.setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={messageManagement.setNumEditorLines}
                    socket={socket}
                    useTEM={useTEM}
                    thread={useCM.currentThreadChat as ThreadProps}
                    useUISM={useUISM}
                    setCurrentChat={
                        useCM.setCurrentThreadChat as (chat: ChatProps | ThreadProps) => void
                    }
                />
            </Sheet>
        </div>
    );
};
