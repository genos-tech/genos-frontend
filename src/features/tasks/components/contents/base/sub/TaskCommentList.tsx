import React, { useRef, useState } from "react";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../../../types/chat";
import { TaskCommentProps } from "../../../../../../types/tasks";
import { useScrollToTaskCommentByCommentId } from "../../../../hooks/taskCommentHooks";
import { TaskCommentBubble } from "./TaskCommentBubble";

type TaskCommentListProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    taskComments: TaskCommentProps[];
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    currentProjectId?: number | null;
    currentProjectName?: string | null;
    /** Optional cap on the rendered list height. Defaults to 800 to
     * match the prior in-line behaviour inside TaskTabBlock; chat
     * thread mounts pass a larger value so the list breathes. Ignored
     * when `fillContainer` is true (Virtuoso then fills the parent's
     * flex slot and owns scrolling on its own). */
    maxHeight?: number;
    /** When true, render Virtuoso as a `flex: 1` child that fills its
     * parent's height instead of using the line-count height heuristic.
     * The chat thread's "Comments" tab uses this so we get a single
     * native Virtuoso scroller (no double-scrolling outer wrapper). */
    fillContainer?: boolean;
    /** Builds the deep-link URL to navigate to when a comment is
     * clicked. Each parent supplies the URL shape that matches its
     * mount: chat-thread (`/workspace/chat/pm/...`) or task-panel
     * (`/workspace/tasks/project/...`). When omitted, comments are not
     * clickable and the bubble keeps its original visual behaviour. */
    commentLinkBuilder?: (commentId: number) => string;
    /** Comment id parsed from the URL's `comment/:commentId` segment,
     * scoped to this mount's URL shape by the parent. Bubble matching
     * this id renders in the focused palette, and Virtuoso scrolls it
     * into view. */
    focusedCommentId?: number;
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

/**
 * Virtuoso-driven comment list extracted from `TaskTabBlock` so the
 * chat thread's new "Comments" tab can mount the same UI without
 * dragging in the rest of the tab block (notes, attachments, modals).
 *
 * Rendering, scroll-to-bottom-on-new-comment behaviour and the empty
 * state mirror the original inline implementation byte-for-byte; the
 * empty state's icon container width was preserved so existing visual
 * regression snapshots stay green.
 */
export const TaskCommentList = ({
    socket,
    myself,
    setMyself,
    taskComments,
    setIsInEdit,
    setEditTargetComment,
    useTEM,
    useUISM,
    useCM,
    currentProjectId,
    currentProjectName,
    maxHeight = 800,
    fillContainer = false,
    commentLinkBuilder,
    focusedCommentId,
    setTodoFromMessageBubble,
}: TaskCommentListProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const navigate = useNavigate();

    // Virtuoso reports its rendered content size; we cap it at
    // `maxHeight`. This lets the list grow naturally with new comments
    // (no precomputed heuristic) up to the parent's height budget.
    // Initial value matches `maxHeight` so the first render has room
    // for Virtuoso to measure all items before reporting back.
    const [contentHeight, setContentHeight] = useState(maxHeight);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    // Auto-scroll to bottom on new comments via Virtuoso's native
    // `followOutput`. This coordinates the height-grow and scroll into
    // a single motion (no separate 300 ms timeout that produced a
    // visible two-step jump). Virtuoso only follows when the user is
    // already at the bottom, so reading an older comment isn't
    // interrupted by an incoming message.
    useScrollToTaskCommentByCommentId(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        taskComments,
        focusedCommentId
    );

    // Hoisted out of `itemContent` so both Virtuoso branches reuse
    // the same wiring without duplicating the click closure.
    const buildCommentClickHandler = (commentId: number) => {
        if (!commentLinkBuilder) return undefined;
        return () => navigate(commentLinkBuilder(commentId));
    };

    if (taskComments.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    py: 4,
                    gap: 1,
                    ...(fillContainer && { flex: 1, minHeight: 0 }),
                }}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        border: "1px dashed",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                    }}
                >
                    <CommentRoundedIcon
                        sx={{
                            fontSize: 24,
                            color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
                        }}
                    />
                </Box>
                <Typography
                    level="body-sm"
                    sx={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}
                >
                    No comments yet
                </Typography>
            </Box>
        );
    }

    // Two layout modes:
    //   - default (TaskTabBlock): a `mb: 2` block where Virtuoso takes
    //     a height computed from the comment payload (capped at
    //     `maxHeight`). The block sits above an editor inside the tab
    //     panel; the surrounding Sheet doesn't constrain height.
    //   - fillContainer (chat thread Comments tab): Virtuoso becomes
    //     a flex: 1 child so it owns the only scrollbar in the column.
    //     The wrapping Sheet/Box must enforce `flex: 1, minHeight: 0`.
    if (fillContainer) {
        return (
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <Virtuoso
                    ref={virtuosoRef}
                    atBottomThreshold={128}
                    atTopThreshold={64}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    followOutput="auto"
                    initialTopMostItemIndex={taskComments.length - 1}
                    totalCount={taskComments.length}
                    itemContent={(index) => {
                        const comment = taskComments[index];
                        return (
                            <TaskCommentBubble
                                key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                                useCM={useCM}
                                comment={comment}
                                myself={myself}
                                setEditTargetComment={setEditTargetComment}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                socket={socket}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                currentProjectId={currentProjectId ?? undefined}
                                currentProjectName={currentProjectName ?? undefined}
                                isFocused={comment.commentId === focusedCommentId}
                                onCommentClick={buildCommentClickHandler(comment.commentId)}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                            />
                        );
                    }}
                    style={{ flex: 1, minHeight: 0 }}
                />
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Virtuoso
                ref={virtuosoRef}
                atBottomThreshold={128}
                atTopThreshold={64}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                followOutput="auto"
                initialTopMostItemIndex={taskComments.length - 1}
                totalCount={taskComments.length}
                itemContent={(index) => {
                    const comment = taskComments[index];
                    return (
                        <TaskCommentBubble
                            key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                            useCM={useCM}
                            comment={comment}
                            myself={myself}
                            setEditTargetComment={setEditTargetComment}
                            setIsInEdit={setIsInEdit}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            currentProjectId={currentProjectId ?? undefined}
                            currentProjectName={currentProjectName ?? undefined}
                            isFocused={comment.commentId === focusedCommentId}
                            onCommentClick={buildCommentClickHandler(comment.commentId)}
                            setTodoFromMessageBubble={setTodoFromMessageBubble}
                        />
                    );
                }}
                totalListHeightChanged={setContentHeight}
                style={{ height: Math.min(contentHeight, maxHeight) }}
            />
        </Box>
    );
};
