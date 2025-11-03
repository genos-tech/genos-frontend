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
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps } from "../../types/chat";

type MessagesPaneProps = {
    TEM: TeamManagementState;
    currentWindowHeight: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentThreadChatId: number;
    UIM: UIStateManagementState;
    TM: TaskManagementState;
    CM: ChatManagementState;
    NM: NoteManagementState;
};

export const ThreadPane = (props: MessagesPaneProps) => {
    const {
        TEM,
        currentWindowHeight,
        myself,
        setMyself,
        socket,
        currentThreadChatId,
        UIM,
        TM,
        CM,
        NM,
    } = props;

    // Use shared hooks
    const messageManagement = useMessageManagement({
        chat: CM.currentThreadChat as ThreadProps,
        isThread: true,
    });
    const readStatusManagement = useReadStatusManagement({
        currentChat: CM.currentThreadChat as ThreadProps,
        myself,
        CM,
        isThread: true,
    });
    const scrollManagement = useScrollManagement({
        currentChat: CM.currentThreadChat as ThreadProps,
        indexMap: messageManagement.indexMap,
        isThread: true,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            if (CM.currentThreadChat) {
                let targetIndex: number;
                if (CM.currentThreadChat?.moveToSpecificIndex === undefined) {
                    targetIndex = CM.currentThreadChat?.messages.length - 1;
                } else if (
                    messageManagement.indexMap &&
                    messageManagement.indexMap[CM.currentThreadChat?.moveToSpecificIndex] &&
                    CM.currentThreadChat?.chatId ===
                        Number(CM.currentThreadChat?.moveToSpecificIndex?.split("-")[0])
                ) {
                    targetIndex = Number(
                        messageManagement.indexMap[CM.currentThreadChat?.moveToSpecificIndex]
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

                <ThreadChatPaneHeader CM={CM} NM={NM} myself={myself} TM={TM} />

                <MessageListRenderer
                    chat={CM.currentThreadChat as ThreadProps}
                    CM={CM}
                    currentChatId={currentThreadChatId}
                    height={virtuosoHeight}
                    indexMap={messageManagement.indexMap}
                    isScrolling={scrollManagement.isScrolling}
                    isThread={true}
                    messages={messageManagement.messages}
                    myself={myself}
                    setCurrentProject={() => {}}
                    setEditTargetMessage={messageManagement.setEditTargetMessage}
                    setErrorMessage={messageManagement.setErrorMessage}
                    setErrorOpen={messageManagement.setErrorOpen}
                    setIsInEdit={messageManagement.setIsInEdit}
                    setIsScrolling={scrollManagement.setIsScrolling}
                    setMyself={setMyself}
                    setVisibleRange={scrollManagement.setVisibleRange}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                    virtuosoRef={scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>}
                    visibleRange={scrollManagement.visibleRange}
                    TM={TM}
                />

                <ChatEditorSection
                    chat={CM.currentThreadChat as ThreadProps}
                    CM={CM}
                    editTargetMessage={messageManagement.editTargetMessage}
                    isInEdit={messageManagement.isInEdit}
                    isThread={true}
                    myself={myself}
                    numEditorLines={messageManagement.numEditorLines}
                    setCurrentThreadChat={CM.setCurrentThreadChat as (chat: ThreadProps) => void}
                    setIsInEdit={messageManagement.setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={messageManagement.setNumEditorLines}
                    socket={socket}
                    TEM={TEM}
                    thread={CM.currentThreadChat as ThreadProps}
                    UIM={UIM}
                    setCurrentChat={
                        CM.setCurrentThreadChat as (chat: ChatProps | ThreadProps) => void
                    }
                />
            </Sheet>
        </div>
    );
};
