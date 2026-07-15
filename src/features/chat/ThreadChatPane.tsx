import { useCallback, useEffect, useState } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
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
import { TaskActivityFeed } from "../tasks/components/contents/base/sub/TaskActivityFeed";
import { useTaskActivities } from "../tasks/hooks/useTaskActivities";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // File drag-and-drop state. Used by the non-PM thread editor
    // (DM/group reply); PM threads route file drops through their
    // task-comment flow instead.
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Two-tab state for PM threads tied to a task / milestone:
    // "activities" (the task's structured audit log — the same
    // `TaskActivityFeed` the task preview's Activity tab renders) and
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

    // Audit rows for the Activities tab. Fetched here rather than inside
    // the feed so switching tabs doesn't refetch and flash, and kept
    // fresh on `genos:task-touched` for this task (a comment posted from
    // the Comments tab writes a `comment_added` row, so hopping back to
    // Activities shows it). Passing a null id while the strip is hidden
    // keeps this a no-op for non-PM / task-less threads.
    const { activities: threadTaskActivities, isLoading: isLoadingThreadTaskActivities } =
        useTaskActivities(myself, showThreadTabStrip ? threadTaskId : null);

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
                    messageManagement.indexMap[useCM.currentThreadChat?.moveToSpecificIndex] !==
                        undefined
                ) {
                    // v3 `moveToSpecificIndex` is the v3 UUID; the
                    // `indexMap[uuid]` lookup is enough validation.
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
                    backgroundColor: "background.body",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minHeight: 0,
                }}
            >
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <ThreadChatPaneHeader myself={myself} useCM={useCM} useNM={useNM} useTM={useTM} />

                {showThreadTabStrip && (
                    <ThreadTabStrip value={threadTabValue} onChange={setThreadTabValue} />
                )}

                {threadTabValue === "comments" && showThreadTabStrip && threadTaskId != null ? (
                    // Comments view (PM thread + task): own scroller + editor.
                    <ThreadCommentsView
                        myself={myself}
                        setMyself={setMyself}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                        socket={socket}
                        threadTaskId={threadTaskId}
                        useCM={useCM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                ) : showThreadTabStrip && threadTaskId != null ? (
                    // Activities: the task's structured audit log, the
                    // same feed as the task preview's Activity tab.
                    // This branch MUST sit above the generic `isPmThread`
                    // one below, which would otherwise swallow it and
                    // render the old message feed.
                    //
                    // `TaskActivityFeed` is a bare `<Stack>` — it owns no
                    // scroller and no height cap, relying on its host to
                    // constrain it (in TaskTabBlock the whole preview
                    // page scrolls). This pane is a fixed-height flex
                    // column, so it needs the flex-filling scroller here
                    // or the feed would overflow with no way to reach the
                    // older rows.
                    <Box
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}
                    >
                        <TaskActivityFeed
                            activities={threadTaskActivities}
                            allTasks={useTM.allTasks}
                            isLoading={isLoadingThreadTaskActivities}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                ) : isPmThread ? (
                    // PM thread without an associated task: read-only
                    // PM-message feed. No editor — Project Updates
                    // threads are read-only by design (mirrors
                    // MainChatPane's `chatType !== 3` editor gate).
                    // Virtuoso flexes to fill the freed bottom space.
                    <MessageListRenderer
                        chat={useCM.currentThreadChat as ThreadProps}
                        currentChatId={currentThreadChatId}
                        height={0}
                        indexMap={messageManagement.indexMap}
                        isScrolling={scrollManagement.isScrolling}
                        isThread={true}
                        messages={messageManagement.messages}
                        myself={myself}
                        setEditTargetMessage={messageManagement.setEditTargetMessage}
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
                ) : (
                    // Non-PM thread (DM / group chat reply). Virtuoso
                    // fills the available space via `fillContainer`;
                    // editor sticks to the bottom with its own
                    // min/max-height caps from App.css.
                    <>
                        <MessageListRenderer
                            chat={useCM.currentThreadChat as ThreadProps}
                            currentChatId={currentThreadChatId}
                            height={0}
                            indexMap={messageManagement.indexMap}
                            isScrolling={scrollManagement.isScrolling}
                            isThread={true}
                            messages={messageManagement.messages}
                            myself={myself}
                            setEditTargetMessage={messageManagement.setEditTargetMessage}
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

                        <ChatEditorSection
                            chat={useCM.currentThreadChat as ThreadProps}
                            clearPendingFiles={clearPendingFiles}
                            editTargetMessage={messageManagement.editTargetMessage}
                            isInEdit={messageManagement.isInEdit}
                            isThread={true}
                            myself={myself}
                            numEditorLines={messageManagement.numEditorLines}
                            pendingFiles={pendingFiles}
                            setIsInEdit={messageManagement.setIsInEdit}
                            setMyself={setMyself}
                            setNumEditorLines={messageManagement.setNumEditorLines}
                            socket={socket}
                            thread={useCM.currentThreadChat as ThreadProps}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            setCurrentChat={
                                useCM.setCurrentThreadChat as (
                                    chat: ChatProps | ThreadProps
                                ) => void
                            }
                            setCurrentThreadChat={
                                useCM.setCurrentThreadChat as (chat: ThreadProps) => void
                            }
                        />
                    </>
                )}
            </Sheet>
        </div>
    );
};
