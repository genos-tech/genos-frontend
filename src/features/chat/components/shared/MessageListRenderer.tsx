import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useFollowOwnOutput } from "../../hooks/useFollowOwnOutput";
import { useReactionSeenClear } from "../../hooks/useReactionSeenClear";
import { useScrollIndicator } from "../../hooks/useScrollIndicator";
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
     * pane's `visibleRangeRef`. Deliberately not React state: see the note in
     * that hook. No longer advances the read cursor (that's `onMessageSeenIndex`
     * now — the range spans the overscan, so it marked unseen rows read). */
    onRangeChanged: (range: VisibleRange) => void;
    /** Index to land on when the pane opens, or `null`/omitted to land at the
     * bottom (Virtuoso's default). Set to the first unread message so opening a
     * channel with unread history doesn't shove the cursor to the newest
     * message. Only read at MOUNT (via `initialTopMostItemIndex`); the Virtuoso
     * remount key makes each chat switch a fresh mount. See `useFirstUnreadIndex`. */
    firstUnreadIndex?: number | null;
    /** Per-row "this bubble was genuinely seen" sink → advances the read cursor
     * precisely (`useReadStatusManagement.handleSeenIndex`). Fired from the
     * reaction-seen IntersectionObserver, so overscan rows never count. Receives
     * the row's array index (resolved from its v3 UUID via `indexMap`). */
    onMessageSeenIndex?: (index: number) => void;
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

// Render this many extra pixels of rows above/below the viewport. Each
// row mounts a message body (mostly plain-DOM light bodies now that
// images/files/hashtags render without a BlockNote editor; only code/table
// bodies still mount one), so mounting it while it's still off-screen —
// instead of the frame it scrolls into view — is what keeps wheel scrolling
// smooth.
// It is ALSO what anchors the initial paint: `initialTopMostItemIndex`
// resolves "the bottom" against estimated row heights, and rows measure
// taller once they mount. The overscan gives Virtuoso enough real rows
// above LAST to correct against. Ramping it up from 0 after mount (tried,
// reverted) saved mount work but left switches landing part-way up the
// history instead of at the newest message — don't reintroduce it without
// checking the landing position in a real browser.
//
// Widening this into a large asymmetric "pre-render window" (top 1200 /
// bottom 600, PR #432) was tried to smooth phone scrolling and reverted:
// it didn't help the phone and only added mount cost, so this is back to
// the modest symmetric value that predates it.
const OVERSCAN_PX = 600;

// Seed Virtuoso's size estimate for rows it hasn't measured yet. Without a
// default, Virtuoso "probes" the FIRST rendered row and extrapolates that
// height onto all unmeasured rows — and because we land at `LAST`, that probe
// is a RECENT message, usually a short one-liner. Older history (multi-line,
// images, date separators) then measures far taller than the estimate. When an
// iOS momentum fling drags those never-measured rows into view above the
// overscan, react-virtuoso's upward scroll-position correction accumulates the
// per-row (measured - estimate) error into a hidden `marginTop` and flushes it
// after the finger lifts (iOS-only) — a large accumulated error snaps the list
// to the top (the "scroll up a bit and it jumps to the top on its own" bug).
// A realistic MEDIAN estimate shrinks that per-row error to near zero, so the
// correction stays imperceptible (as it already is on desktop). This only
// seeds UNMEASURED rows; measured rows keep their real heights, so landing at
// the newest message is unchanged, and it skips Virtuoso's probe pass so it
// adds no open-time cost. Split by bubble style because compact rows are much
// shorter (an over-large estimate would drift compact flings the other way);
// the Virtuoso key already includes `bubbleStyle`, so a toggle remounts with
// the right value.
//
// TUNING: these are starting values, deliberately erring HIGH — under-
// estimation reproduces the jump-to-top, over-estimation only causes a mild,
// self-correcting downward settle. Measure a few older multi-line/image/date-
// separator bubbles per style on a real iPhone and set each to the median; a
// media-heavy chat's true median likely runs higher than the full value here.
const ESTIMATED_ITEM_HEIGHT_COMPACT_PX = 48;
const ESTIMATED_ITEM_HEIGHT_FULL_PX = 80;

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
    firstUnreadIndex,
    onMessageSeenIndex,
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
    //
    // The last two arguments come from `chat` — the chat THIS list is
    // rendering — not from `useCM.currentMainChat`. They used to always
    // read the main chat, so a thread pane's auto-follow keyed off a
    // different conversation: any main-chat jump target (an activity
    // click, which is usually how you got to the thread) made the hook
    // bail, and the main chat's `notMove` decided whether a reply of
    // YOURS in the thread pulled the pane down.
    useScrollToBottomOnChatChange(
        virtuosoRef,
        currentChatId,
        visibleRangeRef,
        messages.length - 1,
        indexMap,
        chat.moveToSpecificIndex,
        chat.notMove,
        firstUnreadIndex
    );

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { style: bubbleStyle } = useBubbleStylePreference();
    const isCompact = bubbleStyle === "compact";

    // Scroll-time hover suppression (bubbles sliding under a stationary
    // cursor must not fire hover handlers — toolbar mounts, emotion style
    // recomputes). This used to thread an `isScrolling` boolean through
    // Virtuoso's `context` into `itemContent`, which re-rendered the ENTIRE
    // visible window twice per gesture (on scroll start AND stop) — exactly
    // at momentum onset, competing with Virtuoso's own repositioning on a
    // weak phone. Now it's a class toggled IMPERATIVELY on the scroller (no
    // React state, no re-render); a CSS rule (`.chat-msg-scrolling
    // .chat-msg-row`) does the suppression. Touch/wheel still reach the
    // scroller itself, so scrolling is unaffected.
    const scrollerElRef = useRef<HTMLElement | null>(null);
    const handleIsScrolling = useCallback((scrolling: boolean) => {
        scrollerElRef.current?.classList.toggle("chat-msg-scrolling", scrolling);
    }, []);

    // Custom right-edge scroll-position indicator for touch devices, where
    // iOS hides the native scrollbar between gestures (desktop keeps its
    // `.custom-scrollbar-*` bar). Updates imperatively (refs + rAF, no React
    // state) and only reads geometry, so it never re-renders the list or
    // perturbs Virtuoso's scrolling. See the hook for detail.
    const { scrollerRefCallback, thumbRef } = useScrollIndicator();

    // Resolve a genuinely-seen row (`data-msg-key`) to its array index and
    // forward it to read-status. Held in refs so the callback stays a single
    // stable identity for the pane's life (it feeds the reaction-seen observer,
    // which must not be rebuilt on every render). `indexMap` is keyed by the v3
    // UUID → index; a row without a UUID (optimistic echo, legacy row) carries a
    // `seq:` key that isn't in the map and resolves to `undefined`, so it's
    // skipped — it can't be a real cursor position anyway.
    const indexMapRef = useRef(indexMap);
    indexMapRef.current = indexMap;
    const onMessageSeenIndexRef = useRef(onMessageSeenIndex);
    onMessageSeenIndexRef.current = onMessageSeenIndex;
    const handleMessageSeen = useCallback((messageKey: string) => {
        const forward = onMessageSeenIndexRef.current;
        if (!forward) return;
        const index = indexMapRef.current?.[messageKey];
        if (typeof index === "number") forward(index);
    }, []);

    // Clear REACTION sidebar activities when the reacted-to bubble is
    // actually scrolled into view — the read cursor can't (it's forward-only
    // and reactions point back at old messages). Renderer-level so all three
    // chat panes (main / sub / thread) get it for free. Both handles are
    // imperative (IntersectionObserver rooted on the scroller + a ref
    // callback per row); neither re-renders the list on scroll. The same
    // true-seen signal also advances the read cursor precisely (`onMessageSeen`
    // → `handleMessageSeen` → the pane's `handleSeenIndex`).
    const { registerScroller, rowRef } = useReactionSeenClear({
        isThread,
        onMessageSeen: handleMessageSeen,
        useCM,
    });

    // Merged callback for Virtuoso's `scrollerRef`. MUST be stable: Virtuoso
    // republishes every prop on each render and re-runs its scroll-setup
    // effect whenever the `scrollerRef` value changes identity (cleanup calls
    // it with `null`, then re-runs with the element). An inline arrow here
    // would fire that teardown/re-attach on EVERY parent render — which would
    // rebuild the reaction-seen observer and drop its live rows. All three
    // targets below are stable (a ref + two stable `useCallback`s), so this
    // stays a single identity for the pane's life. `el` is the scroll
    // container; it's only `Window` under `useWindowScroll`, which we don't use.
    const handleScrollerRef = useCallback(
        (el: HTMLElement | Window | null) => {
            const scroller = el as HTMLElement | null;
            scrollerElRef.current = scroller;
            // Scroll-indicator hook: attaches its passive, read-only listener.
            scrollerRefCallback(scroller);
            // Reaction-seen observer: roots on the chat scroller so overscan
            // rows (outside its clip box) never count as "seen".
            registerScroller(scroller);
        },
        [scrollerRefCallback, registerScroller]
    );

    // Identity of the chat (or thread) currently rendered. Drives the
    // Virtuoso remount key below.
    const chatIdentityKey = isThread
        ? `${chat.chatId}:${(chat as ThreadProps).threadId}`
        : `${chat.chatId}`;

    // Same keys `indexMap` and `resolveFocusedState` use. Legacy rows can
    // arrive without a v3 uuid, so fall back to the sequence id — this
    // only has to CHANGE when a new row lands at the end.
    const getMessageKey = useCallback(
        (message: MessageProps | ThreadMessageProps) => {
            const key = isThread
                ? (message as ThreadMessageProps).messageIdWithChatIdAndThreadId
                : (message as MessageProps).messageIdWithChatId;
            return key ? String(key) : `seq:${message.messageId}`;
        },
        [isThread]
    );
    // PM (chatType 3) is a read-only task-card feed with no composer, so
    // there is no "I just sent this" gesture to honour — a card for a task
    // created elsewhere must not yank a reader out of the history. Every
    // other kind follows the sender.
    const isOwnMessage = useCallback(
        (message: MessageProps | ThreadMessageProps) =>
            chat.chatType !== 3 && message.sender.userId === myself.userId,
        [chat.chatType, myself.userId]
    );
    // Sticky-bottom policy: always follow my own new message, follow
    // everyone else's only while I'm already at the bottom. See
    // `resolveFollowOutput` for why this is `followOutput` and not a
    // `scrollToIndex` on send.
    const followOutput = useFollowOwnOutput({
        getKey: getMessageKey,
        isOwn: isOwnMessage,
        resetKey: chatIdentityKey,
        rows: messages,
    });

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
        // `chatId` is still typed `string | number` mid-v3-migration;
        // the runtime value is the channel UUID string.
        channelService.isSyncingChannel(String(chat.chatId));

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
        (index: number) => {
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
                // `chat-msg-row` carries two things (see App.css):
                //  - `contain: layout` bounds each row's reflow so Virtuoso's
                //    per-frame paddingTop rewrite during momentum scroll
                //    doesn't reflow every row's internals.
                //  - under `.chat-msg-scrolling` (toggled imperatively on the
                //    scroller while scrolling) it gets `pointer-events: none`,
                //    so bubbles sliding under a stationary cursor can't fire
                //    hover handlers. Wheel/touch still reach the scroller.
                // `ref`/`data-msg-key` feed the reaction-seen observer: the
                // observer reads `data-msg-key` at INTERSECTION time (not at
                // observe time), so it stays correct through Virtuoso's node
                // recycling on scroll/prepend. The key is the bubble's v3
                // UUID — the same value a reaction activity stores in
                // `messageUniqueKey`.
                <div ref={rowRef} className="chat-msg-row" data-msg-key={getMessageKey(message)}>
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
            getMessageKey,
            rowRef,
        ]
    );

    // When `fillContainer` is set, the surrounding Sheet uses
    // `flex: 1` so we let Virtuoso flex into the available height
    // instead of relying on the magic-number `height` prop. Both modes
    // need to coexist because the same renderer is used for the main
    // chat (fixed-height calc, header + editor below) and for the
    // editor-less PM activities thread (full flex).
    // `position: relative` anchors the absolutely-positioned scroll indicator
    // (rendered as a sibling of Virtuoso below) to the pane in both modes.
    const wrapperSx = fillContainer
        ? ({
              px: 0.3,
              my: 0.2,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
          } as const)
        : ({ px: 0.3, my: 0.2, position: "relative" } as const);
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
    // (`chatIdentityKey` is computed near the top of this component.)
    //
    // `hasRows` is folded into the key too, so a Virtuoso that mounted
    // EMPTY remounts the moment its messages land. This only bites a slow
    // cold sync: if a channel's history takes longer than `SKELETON_MAX_MS`
    // to arrive, the skeleton backstop expires and Virtuoso mounts with
    // `totalCount = 0`. `initialTopMostItemIndex` is mount-only AND
    // `firstUnreadIndex` isn't knowable until messages exist (it freezes on
    // the first non-empty render — see `useFirstUnreadIndex`), so that empty
    // mount bakes in `{ index: "LAST" }`. When the rows then arrive with no
    // remount, Virtuoso is already parked at the bottom and the seen-observer
    // marks the whole backlog read — the exact bug this feature fixes, just
    // triggered by sync latency instead of the range. Keying on `hasRows`
    // forces the empty→populated transition to remount, re-evaluating
    // `initialTopMostItemIndex` against the now-frozen first-unread index.
    // Warm chats have rows on their first render, so they mount populated
    // once and this never fires for them.
    const hasRows = messages.length > 0;

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
                key={`${bubbleStyle}:${chatIdentityKey}:${hasRows}`}
                ref={virtuosoRef}
                atBottomThreshold={128}
                atTopStateChange={handleAtTop}
                atTopThreshold={64}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                followOutput={followOutput}
                increaseViewportBy={{ bottom: OVERSCAN_PX, top: OVERSCAN_PX }}
                isScrolling={handleIsScrolling}
                itemContent={itemContent}
                rangeChanged={onRangeChanged}
                scrollerRef={handleScrollerRef}
                style={virtuosoStyle}
                totalCount={messages.length}
                defaultItemHeight={
                    isCompact ? ESTIMATED_ITEM_HEIGHT_COMPACT_PX : ESTIMATED_ITEM_HEIGHT_FULL_PX
                }
                initialTopMostItemIndex={
                    firstUnreadIndex != null
                        ? { align: "start", index: firstUnreadIndex }
                        : { align: "end", index: "LAST" }
                }
            />
            {/* Custom scroll-position indicator (touch devices only — the
                hook no-ops on fine-pointer desktop). Absolutely positioned
                against the `position: relative` wrapper; `pointer-events:
                none` so it never intercepts touch/taps. Driven imperatively
                via `thumbRef` — starts at opacity 0 until the hook measures. */}
            <div ref={thumbRef} className="chat-scroll-indicator" />
        </Box>
    );
};
