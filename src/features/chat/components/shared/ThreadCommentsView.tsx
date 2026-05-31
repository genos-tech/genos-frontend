import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation } from "react-router-dom";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskCommentProps, TaskProps } from "../../../../types/tasks";
import { TaskCommentEditorBlock } from "../../../tasks/components/contents/base/sub/TaskCommentEditorBlock";
import { TaskCommentList } from "../../../tasks/components/contents/base/sub/TaskCommentList";
import { loadTaskComments } from "../../../tasks/services/loadTaskComments";

type ThreadCommentsViewProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** Task / milestone backing this thread. The thread message bubble
     * already loads it onto `useTM.currentPreviewTask`; we fall back
     * to the active main-chat metadata when that hasn't hydrated. */
    threadTaskId: number;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

/**
 * The "Comments" tab body inside a PM thread chat. Reuses the same
 * `TaskCommentList` + `TaskCommentEditorBlock` pair as TaskTabBlock,
 * so posting a comment from here flows through the existing
 * `socket.emit("task_comment", …)` path → hits Django →
 * `wsType === "task"` socket bounce → `useTM.isTaskCommentUpdated`
 * → autorefetch.
 *
 * The view ALWAYS owns its own `taskComments` load: when the chat
 * thread is open standalone (preview pane closed), nothing else is
 * loading the comments for `threadTaskId`. We still write into
 * `useTM.taskComments` so an opened TaskPreview shares the cache.
 */
export const ThreadCommentsView = ({
    socket,
    myself,
    setMyself,
    useTM,
    useTEM,
    useCM,
    useUISM,
    threadTaskId,
    setTodoFromMessageBubble,
}: ThreadCommentsViewProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [isInEdit, setIsInEdit] = useState(false);
    const [editTargetComment, setEditTargetComment] = useState<TaskCommentProps>();

    // Independent load — TaskPreview / MilestonePreview may not be
    // mounted when only the chat thread is visible. Refetch on the
    // socket-flag flips that the rest of the app already uses.
    useEffect(() => {
        if (!threadTaskId || threadTaskId <= 0) return;
        let cancelled = false;
        (async () => {
            const loaded = await loadTaskComments(myself, threadTaskId, accessToken);
            if (cancelled) return;
            useTM.setTaskComments(loaded?.length ? loaded : []);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadTaskId, useTM.isTaskCommentUpdated, accessToken]);

    // The editor needs a `task` shape. Prefer the fully-hydrated
    // `currentPreviewTask` (set by message-bubble click), otherwise
    // synthesize the minimum shape (`id`, `project`) from the active
    // main chat so posting still routes correctly.
    const task: TaskProps | null = useMemo(() => {
        const preview = useTM.currentPreviewTask;
        if (preview && Number(preview.id) === threadTaskId) {
            return preview;
        }
        const main = useCM.currentMainChat;
        if (!main) return null;
        // Synthesised stub. Only `id` + `project.{projectId,projectName,isPrivate}`
        // are read by `BnTaskCommentEditor`; the rest stays null/undefined.
        return {
            id: threadTaskId,
            project: {
                projectId: (main as any).chatId,
                projectName: (main as any).chatName,
                isPrivate: (main as any).isPrivate,
            },
        } as unknown as TaskProps;
    }, [useTM.currentPreviewTask, threadTaskId, useCM.currentMainChat]);

    // Deep-link plumbing for the chat-thread mount of `TaskCommentList`.
    //
    // The chat thread URL shape is
    //   `/workspace/chat/pm/:chatId/thread/:threadId/comment/:commentId`
    // For PMs the `:threadId` segment is the parent task id (see
    // `ThreadMessageBubble.handleMessageClick`), which matches our
    // `threadTaskId` here. We only honour the URL's `commentId` when the
    // path is in this exact shape AND its `:threadId` segment matches
    // our task — otherwise the same URL parsed by the task-panel mount
    // would also end up highlighting in here (see notes in plan).
    const location = useLocation();
    const chatId = useCM.currentMainChat?.chatId;
    const focusedCommentId = useMemo<number | undefined>(() => {
        const parts = location.pathname.split("/").filter(Boolean);
        if (parts[0] !== "workspace" || parts[1] !== "chat" || parts[2] !== "pm") return undefined;
        const threadIdx = parts.indexOf("thread");
        const commentIdx = parts.indexOf("comment");
        if (threadIdx === -1 || commentIdx === -1) return undefined;
        const urlThreadId = Number(parts[threadIdx + 1]);
        if (!Number.isFinite(urlThreadId) || urlThreadId !== threadTaskId) return undefined;
        const parsed = Number(parts[commentIdx + 1]);
        return Number.isFinite(parsed) ? parsed : undefined;
    }, [location.pathname, threadTaskId]);

    const commentLinkBuilder = useCallback(
        (commentId: number) =>
            `/workspace/chat/pm/${chatId}/thread/${threadTaskId}/comment/${commentId}`,
        [chatId, threadTaskId]
    );

    if (!task) return null;

    return (
        <Sheet
            sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: "background.body",
            }}
        >
            {/* Single scroll surface — Virtuoso owns it. The wrapper
             * here only adds horizontal padding; we don't set
             * `overflowY` because that would create a parasitic
             * second scrollbar around Virtuoso's own. */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    px: 2,
                    py: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <TaskCommentList
                    commentLinkBuilder={chatId !== undefined ? commentLinkBuilder : undefined}
                    currentProjectId={task.project?.projectId}
                    currentProjectName={task.project?.projectName}
                    currentTaskDisplayId={task.displayId}
                    focusedCommentId={focusedCommentId}
                    myself={myself}
                    setEditTargetComment={setEditTargetComment}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setTodoFromMessageBubble={setTodoFromMessageBubble}
                    socket={socket}
                    taskComments={useTM.taskComments}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    fillContainer
                />
            </Box>
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    borderTop: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
            >
                <TaskCommentEditorBlock
                    editTargetComment={editTargetComment}
                    isInEdit={isInEdit}
                    myself={myself}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setTaskCommentLines={useTM.setTaskCommentLines}
                    setTaskComments={useTM.setTaskComments}
                    socket={socket}
                    task={task}
                    taskCommentLines={useTM.taskCommentLines}
                    taskComments={useTM.taskComments}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            </Box>
        </Sheet>
    );
};
