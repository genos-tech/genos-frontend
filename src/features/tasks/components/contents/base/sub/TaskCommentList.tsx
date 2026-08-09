import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { ScrollSeekPlaceholderProps, Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../../../types/chat";
import { TaskCommentProps } from "../../../../../../types/tasks";
import { useFollowOwnOutput } from "../../../../../chat/hooks/useFollowOwnOutput";
import { useScrollToTaskCommentByCommentId } from "../../../../hooks/taskCommentHooks";
import { TaskCommentBubble } from "./TaskCommentBubble";

// Velocity thresholds (px per ~100ms sample — Virtuoso measures scroll
// speed as delta-scrollTop over a throttled 100ms window) that gate
// "scroll seek" mode: above `ENTER`, rows render as cheap fixed-height
// placeholders instead of full comment bubbles, so each catch-up render
// finishes inside the frame and Virtuoso's main-thread paddingTop
// reposition stays in sync with the compositor-driven momentum scroll —
// this is what stops the transient duplicate/ghost rows on a low-CPU
// phone. Below `EXIT` the real bubbles paint again. Mirrors
// `MessageListRenderer` (see the note there); comment bodies render the
// same BlockNote views, so they carry the same catch-up cost.
// TUNE ON A REAL PHONE: a resized desktop can't reproduce the jank.
const SEEK_ENTER_VELOCITY = 700;
const SEEK_EXIT_VELOCITY = 30;

// Delay after the arm key changes before scroll-seek may engage. Unlike
// the chat list, this Virtuoso is NOT remounted per task (no `key`), so
// `initialTopMostItemIndex` does NOT re-land on a task switch — the spike
// this must guard is the deep-link landing: `useScrollToTaskCommentByCommentId`
// fires `scrollToIndex({ align: "center", behavior: "smooth" })` 300ms after
// `focusedCommentId`/`taskComments` change. That smooth (animated, multi-row)
// scroll can exceed `SEEK_ENTER_VELOCITY`; if seek engaged mid-landing the
// focused comment would fail to land centered (placeholders shift the
// measured offset). So the arm effect keys on BOTH the tail taskId AND
// `focusedCommentId`, and the delay is longer than chat's (past the 300ms
// timer PLUS the smooth-scroll animation and settle).
const SEEK_ARM_DELAY_MS = 1200;

// Cheap stand-in painted for each row while the list is being flung fast
// (see the velocity thresholds above). It reserves the row's known/
// estimated height verbatim — matching the height is load-bearing: a
// mismatch would make Virtuoso re-measure on seek-exit and reintroduce
// the very offset churn this is meant to remove. No bubble, no editor,
// no MUI — just a sized block with a barely-there tint so a fast fling
// reads as motion rather than a jarring blank.
const ScrollSeekPlaceholder = ({ height }: ScrollSeekPlaceholderProps) => (
    <div
        style={{
            height,
            boxSizing: "border-box",
            padding: "0.3rem 0",
        }}
    >
        <div
            style={{
                height: "100%",
                borderRadius: "12px",
                background: "var(--alt-background)",
                opacity: 0.5,
            }}
        />
    </div>
);

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
    /** Parent task's human-readable id ("<code>-<n>"), threaded to
     *  each `TaskCommentBubble` so its reaction emits can carry the
     *  friendly id on the derived activity broadcast. */
    currentTaskDisplayId?: string | null;
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
    /** Hosting surface's stacking level, forwarded to each bubble so
     * its delete-confirm dialog stacks above a UrlLinkModal-hosted
     * preview. Supplied by the `TaskTabBlock` mount; the chat-thread
     * mount doesn't thread one (page-hosted default). */
    hostZIndex?: number;
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
    currentTaskDisplayId,
    maxHeight = 800,
    fillContainer = false,
    commentLinkBuilder,
    focusedCommentId,
    setTodoFromMessageBubble,
    hostZIndex,
}: TaskCommentListProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const navigate = useNavigate();

    // Scroll-time hover suppression (bubbles sliding under a stationary
    // cursor must not fire hover handlers — toolbar mounts, emotion style
    // recomputes). This used to thread an `isScrolling` boolean through
    // Virtuoso's `context` into `itemContent`, which re-rendered the ENTIRE
    // visible window twice per gesture (scroll start AND stop) — exactly at
    // momentum onset, competing with Virtuoso's own repositioning on a weak
    // phone. Now it's a class toggled IMPERATIVELY on the scroller (no React
    // state, no re-render); a CSS rule (`.comment-scrolling .comment-row`)
    // does the suppression. Touch/wheel still reach the scroller itself, so
    // scrolling is unaffected. Mirrors `MessageListRenderer`.
    const scrollerElRef = useRef<HTMLElement | null>(null);
    const handleIsScrolling = useCallback((scrolling: boolean) => {
        scrollerElRef.current?.classList.toggle("comment-scrolling", scrolling);
    }, []);

    // Scroll-seek is armed only after a landing settles — see
    // `SEEK_ARM_DELAY_MS`. `enter`/`exit` read the ref (not a dep) so the
    // config is stable across renders (Virtuoso re-subscribes if it changes).
    const seekArmedRef = useRef(false);
    const scrollSeekConfiguration = useMemo(
        () => ({
            enter: (velocity: number) =>
                seekArmedRef.current && Math.abs(velocity) > SEEK_ENTER_VELOCITY,
            exit: (velocity: number) => Math.abs(velocity) < SEEK_EXIT_VELOCITY,
        }),
        []
    );

    // Disarm scroll-seek whenever a programmatic landing may run, and re-arm
    // once it has settled, so a landing scroll can't trip seek mode and mount
    // fixed-size placeholders mid-landing. Two triggers, unlike chat:
    //   - the tail comment's taskId changes → a real task switch (stable
    //     across same-task reaction/edit/append churn, which keeps the tail);
    //   - `focusedCommentId` changes → a deep-link jump, whose
    //     `scrollToIndex(..., behavior: "smooth")` is an animated multi-row
    //     scroll that would otherwise spike velocity past `SEEK_ENTER`.
    // Declared BEFORE the `taskComments.length === 0` early return so hook
    // order stays stable across empty↔non-empty transitions.
    const tailTaskId = String(taskComments[taskComments.length - 1]?.taskId ?? "");
    useEffect(() => {
        seekArmedRef.current = false;
        const t = setTimeout(() => {
            seekArmedRef.current = true;
        }, SEEK_ARM_DELAY_MS);
        return () => clearTimeout(t);
    }, [tailTaskId, focusedCommentId]);

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

    // ...with one exception to "only when already at the bottom": a
    // comment *I* just posted always pulls the list down, even if I had
    // scrolled up to re-read something before typing it. The plain
    // unconditional `followOutput` this replaces left your own comment
    // off-screen in that case. See `resolveFollowOutput`.
    //
    // `resetKey` is the task these comments belong to (every row carries
    // it) so the pending-append flag can't survive into another task's
    // list — this component is reused across tasks without remounting.
    const followOutput = useFollowOwnOutput({
        getKey: useCallback((comment: TaskCommentProps) => String(comment.commentId), []),
        isOwn: useCallback(
            (comment: TaskCommentProps) => comment.senderId === myself.userId,
            [myself.userId]
        ),
        resetKey: String(taskComments[taskComments.length - 1]?.taskId ?? ""),
        rows: taskComments,
    });

    // ONE stable click handler shared by every row (bound to the row's
    // id inside the bubble). A fresh per-row closure here would defeat
    // `TaskCommentBubble`'s `memo` and re-render every visible row on any
    // parent render. Undefined when no link builder is wired so the
    // bubble keeps its non-clickable behaviour.
    const handleCommentClick = useCallback(
        (commentId: number) => {
            if (!commentLinkBuilder) return;
            navigate(commentLinkBuilder(commentId));
        },
        [commentLinkBuilder, navigate]
    );
    const onCommentClick = commentLinkBuilder ? handleCommentClick : undefined;

    // Hoisted out of the Virtuoso element into a stable `useCallback`
    // shared by both layout branches — Virtuoso re-renders every visible
    // row whenever `itemContent` changes identity, so an inline arrow
    // re-rendered the whole window on every list render.
    const itemContent = useCallback(
        (index: number) => {
            const comment = taskComments[index];
            return (
                // `comment-row` carries two things (see App.css):
                //  - `contain: layout` bounds each row's reflow so Virtuoso's
                //    per-frame paddingTop rewrite during momentum scroll
                //    doesn't reflow every row's bubble internals.
                //  - under `.comment-scrolling` (toggled imperatively on the
                //    scroller while scrolling) it gets `pointer-events: none`,
                //    so bubbles sliding under a stationary cursor can't fire
                //    hover handlers. Wheel/touch still reach the scroller.
                <div className="comment-row">
                    <TaskCommentBubble
                        key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                        comment={comment}
                        commentLink={commentLinkBuilder?.(comment.commentId)}
                        currentProjectId={currentProjectId ?? undefined}
                        currentProjectName={currentProjectName ?? undefined}
                        currentTaskDisplayId={currentTaskDisplayId ?? undefined}
                        hostZIndex={hostZIndex}
                        isFocused={comment.commentId === focusedCommentId}
                        myself={myself}
                        setEditTargetComment={setEditTargetComment}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        onCommentClick={onCommentClick}
                    />
                </div>
            );
        },
        [
            taskComments,
            commentLinkBuilder,
            currentProjectId,
            currentProjectName,
            currentTaskDisplayId,
            hostZIndex,
            focusedCommentId,
            myself,
            setEditTargetComment,
            setIsInEdit,
            setMyself,
            setTodoFromMessageBubble,
            socket,
            useCM,
            useTEM,
            useUISM,
            onCommentClick,
        ]
    );

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
                    components={{ ScrollSeekPlaceholder }}
                    followOutput={followOutput}
                    increaseViewportBy={{ top: 600, bottom: 600 }}
                    initialTopMostItemIndex={taskComments.length - 1}
                    isScrolling={handleIsScrolling}
                    itemContent={itemContent}
                    scrollerRef={(el) => {
                        // `el` is the scroll container (HTMLElement); it's
                        // only `Window` when `useWindowScroll` is set, which
                        // we don't.
                        scrollerElRef.current = el as HTMLElement | null;
                    }}
                    scrollSeekConfiguration={scrollSeekConfiguration}
                    style={{ flex: 1, minHeight: 0 }}
                    totalCount={taskComments.length}
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
                components={{ ScrollSeekPlaceholder }}
                followOutput={followOutput}
                increaseViewportBy={{ top: 600, bottom: 600 }}
                initialTopMostItemIndex={taskComments.length - 1}
                isScrolling={handleIsScrolling}
                itemContent={itemContent}
                scrollerRef={(el) => {
                    scrollerElRef.current = el as HTMLElement | null;
                }}
                scrollSeekConfiguration={scrollSeekConfiguration}
                style={{ height: Math.min(contentHeight, maxHeight) }}
                totalCount={taskComments.length}
                totalListHeightChanged={setContentHeight}
            />
        </Box>
    );
};
