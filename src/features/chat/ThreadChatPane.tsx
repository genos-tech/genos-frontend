import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { useChatContext } from "./context/ChatContext";
import { ThreadChatPaneHeader } from "./components/headers/ThreadChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { ThreadCommentsView } from "./components/shared/ThreadCommentsView";
import { ThreadTabId, ThreadTabStrip } from "./components/shared/ThreadTabStrip";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { calculateVirtuosoHight } from "./services/calculateVirtuosoHight";
import { createFileDropHandler } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";

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
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
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
        setTodoFromMessageBubble,
    } = props;

    const { setCurrentThreadTaskId } = useChatContext();

    // File drag-and-drop state. Used by the non-PM thread editor
    // (DM/group reply); PM threads route file drops through their
    // task-comment flow instead.
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Two-tab state for PM threads tied to a task / milestone:
    // "activities" (existing PM message feed, read-only) and
    // "comments" (TaskCommentList + BlockNote editor reused from
    // TaskTabBlock — the only place a user can post). The strip
    // itself is hidden for non-PM threads and for PM threads that
    // have no associated task.
    //
    // Default lands on "comments" because that's the only branch
    // with an editor; opening straight into a read-only activity
    // log surprises users who came here to reply.
    const [threadTabValue, setThreadTabValue] = useState<ThreadTabId>("comments");
    const threadTaskId = useCM.currentThreadChat?.taskId ?? null;
    const threadChatType = useCM.currentThreadChat?.chatType;
    const isPmThread = threadChatType === 3;
    const showThreadTabStrip = isPmThread && threadTaskId != null && threadTaskId > 0;
    // Reset on every thread switch so we don't leak the previous
    // thread's tab choice into a freshly opened one.
    useEffect(() => {
        setThreadTabValue("comments");
    }, [useCM.currentThreadChat?.threadId]);

    // Update currentThreadTaskId when thread panel mounts or thread changes
    useEffect(() => {
        if (useCM.currentThreadChat?.taskId) {
            setCurrentThreadTaskId(useCM.currentThreadChat.taskId);
        } else {
            setCurrentThreadTaskId(-1);
        }
    }, [useCM.currentThreadChat?.taskId, setCurrentThreadTaskId]);

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
            onDrop={handleDrop}
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

                {showThreadTabStrip && (
                    <ThreadTabStrip value={threadTabValue} onChange={setThreadTabValue} />
                )}

                {threadTabValue === "comments" && showThreadTabStrip && threadTaskId != null ? (
                    // Comments view (PM thread + task): own scroller + editor.
                    <ThreadCommentsView
                        socket={socket}
                        myself={myself}
                        setMyself={setMyself}
                        useTM={useTM}
                        useTEM={useTEM}
                        useCM={useCM}
                        useUISM={useUISM}
                        threadTaskId={threadTaskId}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                    />
                ) : isPmThread ? (
                    // Activities (or PM thread without task): read-only
                    // PM-message feed. No editor — these are
                    // auto-generated system bubbles ("Task created /
                    // updated by …") and Project Updates threads are
                    // read-only by design (mirrors MainChatPane's
                    // `chatType !== 3` editor gate). Virtuoso flexes
                    // to fill the freed bottom space.
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
                        virtuosoRef={
                            scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                        }
                        visibleRange={scrollManagement.visibleRange}
                        useTM={useTM}
                        fillContainer
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                    />
                ) : (
                    // Non-PM thread (DM / group chat reply). Keeps the
                    // original list + editor pair so users can still
                    // post replies with the existing fixed-height
                    // calculation.
                    <>
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
                            virtuosoRef={
                                scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                            }
                            visibleRange={scrollManagement.visibleRange}
                            useTM={useTM}
                            setTodoFromMessageBubble={setTodoFromMessageBubble}
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
                            pendingFiles={pendingFiles}
                            clearPendingFiles={clearPendingFiles}
                            setCurrentChat={
                                useCM.setCurrentThreadChat as (
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
