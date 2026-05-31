// `simple-import-sort/imports` disabled file-wide: prettier and
// simple-import-sort disagree on the placement of `./ToDoPane` and
// `../../`-prefixed groups (auto-fix loops between the two). Prettier
// wins per project convention.

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
import { createFileDropHandler } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../types/chat";
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
    // null is allowed for surfaces (e.g. the link-preview modal) that
    // never render the todo pane and therefore don't own a useTG instance.
    useTG?: UseTodoGroupsState | null;
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
        isToDoVisible,
        myself,
        usePM,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useTG,
        useCM,
        useTM,
        setTodoFromMessageBubble,
    } = props;

    const { mode } = useColorScheme();

    // File drag-and-drop state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    // `createFileDropHandler(setPendingFiles)` returns a stable handler; the
    // factory itself isn't a stable reference but `setPendingFiles` is the
    // only meaningful dependency and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Use shared hooks
    const messageManagement = useMessageManagement({
        chat: useCM.currentMainChat as ChatProps | ThreadProps,
    });
    const readStatusManagement = useReadStatusManagement({
        currentChat: useCM.currentMainChat as ChatProps | ThreadProps,
        isThread: false,
        myself,
        useCM,
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
                messageManagement.indexMap[useCM.currentMainChat?.moveToSpecificIndex] !==
                    undefined
            ) {
                // v3 `moveToSpecificIndex` is the message's v3 UUID,
                // matching the bubble's `messageIdWithChatId`. The
                // legacy `chatId === split("-")[0]` validation was
                // for the `${chatId}-${seq}` composite key — gone
                // now. `indexMap[uuid]` lookup is enough: a UUID in
                // the open chat resolves; one from a different chat
                // returns `undefined` and we fall through.
                targetIndex = Number(
                    messageManagement.indexMap[useCM.currentMainChat?.moveToSpecificIndex]
                );
            } else {
                targetIndex = -1;
            }

            readStatusManagement.handleReadStatusUpdate(targetIndex);
        }, 1000);
        // Effect fires when `indexMap` changes — that's the resolution event
        // we care about. Including `readStatusManagement` / the chat fields
        // would either rerun on every render (manager rebuilt each render)
        // or double-update when the chat reference changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messageManagement.indexMap]);

    useEffect(() => {
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
        // Periodic update is keyed to scroll movement; the throttling lives
        // inside `handlePeriodicReadStatusUpdate`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollManagement.visibleRange]);

    useEffect(() => {
        setTimeout(() => {
            if (useCM.currentMainChat?.latestMessage) {
                readStatusManagement.updateReadStatus(
                    useCM.currentMainChat?.latestMessage.messageId
                );
            }
        }, 300);
        // Effect is keyed to the chat reference (new chat selected).
        // `readStatusManagement` is rebuilt every render; including it
        // would cause the timeout to chain indefinitely.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentMainChat]);

    // Layout: flex column. The MessageListRenderer fills the available
    // space via `fillContainer` (Virtuoso uses flex: 1, minHeight: 0),
    // and ChatEditorSection sits naturally at the bottom with its own
    // min-height / max-height caps applied in App.css. This replaces
    // the old `calculateVirtuosoHight()` pixel math, which broke on
    // window resize (especially inside the URL-link modal).
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Sheet
                sx={{
                    backgroundColor: "background.surface",
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <Box
                    sx={{
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        minHeight: 0,
                        width: "100%",
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
                    )}

                    {/* To-Do Pane for only myself */}
                    {isToDoVisible === true &&
                        useCM.currentMainChat?.chatType === 1 &&
                        useCM.currentMainChat?.dmPartnerUser.userId === myself.userId &&
                        useTG && (
                            <ToDoPane
                                currentWindowHeight={currentWindowHeight}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useTG={useTG}
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
                                currentChatId={currentMainChatId}
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

                            {useCM.currentMainChat?.chatType !== 3 && (
                                <ChatEditorSection
                                    chat={useCM.currentMainChat as ChatProps | ThreadProps}
                                    clearPendingFiles={clearPendingFiles}
                                    editTargetMessage={messageManagement.editTargetMessage}
                                    isInEdit={messageManagement.isInEdit}
                                    isThread={false}
                                    myself={myself}
                                    numEditorLines={messageManagement.numEditorLines}
                                    pendingFiles={pendingFiles}
                                    setCurrentThreadChat={undefined}
                                    setIsInEdit={messageManagement.setIsInEdit}
                                    setMyself={setMyself}
                                    setNumEditorLines={messageManagement.setNumEditorLines}
                                    socket={socket}
                                    thread={undefined}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
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
