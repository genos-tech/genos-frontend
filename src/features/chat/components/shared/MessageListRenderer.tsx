import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Chip, Stack, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../hooks/common/useBubbleStylePreference";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { TaskCommentProps } from "../../../../types/tasks";
import { useScrollToBottomOnChatChange } from "../../hooks/messageBubbleHooks";
import { VisibleRange } from "../../hooks/useScrollManagement";
import { handleAtTop } from "../../services/handleBubblePositionAction";
import { computeMessageItemMetas } from "../../utils/messageItemMetas";
import { MessageBubble } from "../bubbles/MessageBubble";
import { ThreadMessageBubble } from "../bubbles/ThreadMessageBubble";
import { MessageListSkeleton } from "./MessageListSkeleton";

interface MessageListRendererProps {
    chat: ChatProps | ThreadProps;
    currentChatId: number;
    height: number;
    indexMap?: { [k: string]: any };
    isThread: boolean;
    messages: MessageProps[] | ThreadMessageProps[];
    myself: UserProps;
    usePM: ProjectManagementState;
    setEditTargetMessage: (message: MessageProps | ThreadMessageProps) => void;
    setIsInEdit: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    /** Stable `rangeChanged` sink from `useScrollManagement` — writes the
     * pane's `visibleRangeRef` and forwards to read-status. Deliberately
     * not React state: see the note in that hook. */
    onRangeChanged: (range: VisibleRange) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    visibleRangeRef: React.RefObject<VisibleRange>;
    virtuosoRef: React.RefObject<VirtuosoHandle>;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    /** When true, ignore `height` and let Virtuoso fill the parent flex
     * column instead. Used by editor-less surfaces (e.g. PM thread's
     * "Activities" tab) where there's no bottom panel to subtract from
     * the calculated height — the parent's `flex: 1, minHeight: 0`
     * already does that work. */
    fillContainer?: boolean;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
}

type ListContext = { isScrolling: boolean };

// Render this many extra pixels of rows above/below the viewport. Each
// row mounts a full read-only BlockNote view (see `BnChatPreview`), so
// mounting it while it's still off-screen — instead of the frame it
// scrolls into view — is what keeps wheel scrolling smooth.
const OVERSCAN_PX = 600;

// ...but that same overscan is pure latency on the frame a chat SWITCH
// paints, because the per-chat Virtuoso key remounts every row at once.
// A BlockNote view costs ~50x a plain node to mount (measured: ~5ms vs
// ~0.1ms in jsdom, before real layout/paint), so 600px of extra rows
// above AND below roughly triples the number of editors built before the
// user sees anything.
//
// So overscan starts at zero for the first paint of a newly-opened chat
// — only what's actually on screen — and is restored two frames later,
// off the critical path. Scrolling still gets the full 600px cushion;
// it's just no longer paid before the chat is visible.
const INITIAL_OVERSCAN_PX = 0;

// Upper bound on how long the cold-load skeleton may stay up. The normal
// exit is messages arriving; this only catches a sync that fails, or one
// that resolves for a genuinely empty channel (which writes nothing, so
// it notifies nothing, so nothing else would re-render this component).
const SKELETON_MAX_MS = 2000;

export const MessageListRenderer = ({
    chat,
    currentChatId,
    height,
    indexMap,
    isThread,
    messages,
    myself,
    usePM,
    setEditTargetMessage,
    setIsInEdit,
    setMyself,
    useUISM,
    onRangeChanged,
    socket,
    useTEM,
    visibleRangeRef,
    virtuosoRef,
    useCM,
    useTM,
    fillContainer = false,
    setTodoFromMessageBubble,
}: MessageListRendererProps) => {
    // Auto-follow only — jumping to a focused message is owned by
    // `useScrollManagement` (see that hook + `resolveJumpScroll`).
    useScrollToBottomOnChatChange(
        virtuosoRef,
        currentChatId,
        visibleRangeRef,
        messages.length - 1,
        indexMap,
        useCM.currentMainChat?.moveToSpecificIndex,
        useCM.currentMainChat?.notMove
    );

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { style: bubbleStyle } = useBubbleStylePreference();
    const isCompact = bubbleStyle === "compact";

    // Scroll-activity flag is LOCAL to this component. It used to live in
    // the pane (`useScrollManagement`), so every scroll start/stop
    // re-rendered the pane's whole tree — header, input editor, list.
    // Nothing outside this list ever read it.
    const [isScrolling, setIsScrolling] = useState(false);
    const listContext = useMemo<ListContext>(() => ({ isScrolling }), [isScrolling]);

    // Identity of the chat (or thread) currently rendered. Drives both the
    // Virtuoso remount key below and the overscan ramp immediately after.
    const chatIdentityKey = isThread
        ? `${chat.chatId}:${(chat as ThreadProps).threadId}`
        : `${chat.chatId}`;

    // Overscan ramp — see `INITIAL_OVERSCAN_PX`. The reset has to happen
    // during render, not in an effect: an effect runs after Virtuoso has
    // already mounted, which is exactly the frame we're trying to keep
    // cheap. This is React's documented "adjust state when a prop
    // changes" pattern (render-phase set on the previous-value guard),
    // so the re-render happens before anything is committed.
    const [overscanPx, setOverscanPx] = useState(INITIAL_OVERSCAN_PX);
    const [renderedChatKey, setRenderedChatKey] = useState(chatIdentityKey);
    if (renderedChatKey !== chatIdentityKey) {
        setRenderedChatKey(chatIdentityKey);
        setOverscanPx(INITIAL_OVERSCAN_PX);
    }

    // A cold channel (never synced this session, nothing in IDB) has no
    // messages to paint until its sync lands, so the pane would sit
    // blank for the whole round-trip. Show placeholder rows instead —
    // but only while the sync is genuinely in flight, so a chat that is
    // really empty still falls through to the normal empty scroller.
    // The timer is a backstop: if the sync fails or resolves without
    // ever bumping the store version (an empty channel notifies
    // nothing), nothing else would re-render us to clear the skeleton.
    const [skeletonExpired, setSkeletonExpired] = useState(false);
    useEffect(() => {
        setSkeletonExpired(false);
        const t = setTimeout(() => setSkeletonExpired(true), SKELETON_MAX_MS);
        return () => clearTimeout(t);
    }, [chatIdentityKey]);
    const showSkeleton =
        messages.length === 0 &&
        !skeletonExpired &&
        renderedChatKey === chatIdentityKey &&
        // `chatId` is still typed `string | number` mid-v3-migration;
        // the runtime value is the channel UUID string.
        channelService.isSyncingChannel(String(chat.chatId));

    // Restore the scroll cushion once the switch has painted. Two rAFs:
    // the first fires before paint, the second after it — so the extra
    // rows mount on a later frame than the one the user is waiting on.
    useEffect(() => {
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setOverscanPx(OVERSCAN_PX));
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [chatIdentityKey]);

    // Every per-row datum, pre-computed in one O(N) pass — see the util
    // for why this must not happen inside `itemContent`.
    const itemMetas = useMemo(
        () => computeMessageItemMetas(messages, isThread, chat.chatType),
        [messages, isThread, chat.chatType]
    );

    // Focus-state inputs change when the user clicks a thread or follows a
    // jump-to-message link, but they're independent of `messages`. Compute
    // the two keys once per context change, then resolve per-row in O(1).
    const focusKey: string | null = useMemo(
        () =>
            isThread
                ? (useCM.currentThreadChat?.moveToSpecificIndex ?? null)
                : (useCM.currentMainChat?.moveToSpecificIndex ?? null),
        [
            isThread,
            useCM.currentThreadChat?.moveToSpecificIndex,
            useCM.currentMainChat?.moveToSpecificIndex,
        ]
    );
    const threadActiveTarget = useMemo<{
        threadId: number | null | undefined;
        taskId: number | null | undefined;
    } | null>(() => {
        if (isThread) return null;
        if (!useCM.isThreadVisible || !useCM.currentThreadChat) return null;
        return {
            taskId: useCM.currentThreadChat.taskId,
            threadId: useCM.currentThreadChat.threadId,
        };
    }, [isThread, useCM.isThreadVisible, useCM.currentThreadChat]);

    const resolveFocusedState = useCallback(
        (message: MessageProps | ThreadMessageProps): "focused" | "threadActive" | false => {
            const messageKey = isThread
                ? (message as ThreadMessageProps).messageIdWithChatIdAndThreadId
                : (message as MessageProps).messageIdWithChatId;
            if (messageKey === focusKey) return "focused";
            if (!threadActiveTarget) return false;
            if (chat.chatType === 3) {
                const taskId = (message as MessageProps).taskId;
                if (taskId && threadActiveTarget.taskId && taskId === threadActiveTarget.taskId) {
                    return "threadActive";
                }
                return false;
            }
            // For non-PM, the parent of the open thread should highlight
            // as "threadActive". `currentThreadChat.threadId` carries the
            // parent's v3 UUID via the migration cast; `messageKey` is the
            // bubble's v3 UUID (via `messageIdWithChatId`). Stringify both
            // sides defensively because the cast is `as unknown as number`.
            if (messageKey && messageKey === String(threadActiveTarget.threadId)) {
                return "threadActive";
            }
            return false;
        },
        [isThread, focusKey, threadActiveTarget, chat.chatType]
    );

    // Stable across renders as long as its real inputs are — Virtuoso
    // re-renders every visible row whenever `itemContent` changes
    // identity, so an inline closure here re-rendered the whole window
    // on every list render.
    const itemContent = useCallback(
        (index: number, _data: unknown, { isScrolling }: ListContext) => {
            const message = messages[index];
            // PM bubbles are task cards — always render received-
            // aligned (left), even when `message.sender.userId`
            // matches the viewer. The legacy task-creation path
            // stamps `sender_id` to the task creator (not the
            // project's system user), so a naive `myself.userId
            // === sender.userId` flips PM bubbles to "sent" /
            // right-aligned for tasks the viewer created. The
            // bubble's task-card layout (no avatar, displayId
            // badge, status chip) is the same regardless.
            const isYou = chat.chatType === 3 ? false : myself.userId === message.sender.userId;
            const isFocused = resolveFocusedState(message);
            const meta = itemMetas[index];
            const dateSeparator = meta.showDateSeparator ? (
                <div style={{ padding: "0.5rem 0" }}>
                    <div style={{ textAlign: "center", fontWeight: 300 }}>
                        <Chip variant="soft">
                            <span
                                style={{
                                    backgroundColor: "var(--alt-background)",
                                    border: "1px solid var(--border)",
                                    padding: "0.1rem 2rem",
                                    borderRadius: "0.5rem",
                                }}
                            >
                                {meta.dateLabel}
                            </span>
                        </Chip>
                    </div>
                </div>
            ) : null;

            return (
                // While the list is actively scrolling, rows opt out of
                // hit-testing: bubbles sliding under a stationary cursor
                // would otherwise fire hover handlers (toolbar mounts,
                // emotion style recomputes) mid-scroll. Wheel events still
                // reach the scroller — it's the rows' ancestor.
                <div style={{ pointerEvents: isScrolling ? "none" : undefined }}>
                    {dateSeparator}
                    <Stack
                        direction="row"
                        spacing={isCompact ? 0 : 2}
                        sx={{
                            flexDirection: isCompact ? "row" : isYou ? "row-reverse" : "row",
                            paddingTop: meta.paddingTop,
                            paddingBottom: meta.paddingBottom,
                            paddingX: isCompact ? 0 : 1,
                        }}
                    >
                        {isThread ? (
                            <ThreadMessageBubble
                                currentMessageIndex={index}
                                isFocused={isFocused}
                                isSimpleBubble={meta.isSimpleBubble}
                                message={message as ThreadMessageProps}
                                myself={myself}
                                setEditTargetMessage={setEditTargetMessage}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                setTargetMessageIndex={() => {}}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                                socket={socket}
                                thread={chat as ThreadProps}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                variant={isYou ? "sent" : "received"}
                            />
                        ) : (
                            <MessageBubble
                                chat={chat as ChatProps}
                                isFocused={isFocused}
                                isSimpleBubble={meta.isSimpleBubble}
                                message={message as MessageProps}
                                myself={myself}
                                setEditTargetMessage={setEditTargetMessage}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                                socket={socket}
                                useCM={useCM}
                                usePM={usePM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                                variant={isYou ? "sent" : "received"}
                            />
                        )}
                    </Stack>
                </div>
            );
        },
        [
            messages,
            itemMetas,
            resolveFocusedState,
            chat,
            myself,
            isCompact,
            isThread,
            socket,
            setEditTargetMessage,
            setIsInEdit,
            setMyself,
            setTodoFromMessageBubble,
            useCM,
            usePM,
            useTEM,
            useTM,
            useUISM,
        ]
    );

    // When `fillContainer` is set, the surrounding Sheet uses
    // `flex: 1` so we let Virtuoso flex into the available height
    // instead of relying on the magic-number `height` prop. Both modes
    // need to coexist because the same renderer is used for the main
    // chat (fixed-height calc, header + editor below) and for the
    // editor-less PM activities thread (full flex).
    const wrapperSx = fillContainer
        ? ({
              px: 0.3,
              my: 0.2,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
          } as const)
        : ({ px: 0.3, my: 0.2 } as const);
    const virtuosoStyle: React.CSSProperties = fillContainer
        ? { flex: 1, minHeight: 0 }
        : { height };

    // Remount Virtuoso whenever the rendered chat (or thread) changes.
    // `initialTopMostItemIndex` only applies at MOUNT, so a reused
    // instance switching from a short chat to a long one kept the old
    // scroll offset — which lands near the TOP of the longer list —
    // until the 300ms jump/auto-follow timers dragged it down. A per-
    // chat key makes every switch paint at the latest message on the
    // first frame, and drops the previous chat's per-item height cache
    // (meaningless for the new one) instead of correcting against it.
    // Same-chat updates (arrivals, edits, reactions) don't change the
    // key, so the reader's scroll position is preserved for those.
    // (`chatIdentityKey` is computed above, next to the overscan ramp.)

    if (showSkeleton) {
        return (
            <Box sx={wrapperSx}>
                <MessageListSkeleton />
            </Box>
        );
    }

    return (
        <Box sx={wrapperSx}>
            <Virtuoso
                key={`${bubbleStyle}:${chatIdentityKey}`}
                ref={virtuosoRef}
                atBottomThreshold={128}
                atTopStateChange={handleAtTop}
                atTopThreshold={64}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                context={listContext}
                increaseViewportBy={{ bottom: overscanPx, top: overscanPx }}
                initialTopMostItemIndex={{ align: "end", index: "LAST" }}
                isScrolling={setIsScrolling}
                itemContent={itemContent}
                rangeChanged={onRangeChanged}
                style={virtuosoStyle}
                totalCount={messages.length}
            />
        </Box>
    );
};
