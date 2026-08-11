/**
 * Clears REACTION sidebar activities as "Read" when the reacted-to message
 * bubble is actually SEEN (scrolled into the chat viewport) — the one signal
 * the forward-only read cursor cannot provide (a reaction to an old message
 * points BACK at that old low-seq bubble the cursor has already passed, which
 * is exactly why the backend excludes REACTION from its seq-sweep).
 *
 * How it stays cheap and jank-free:
 *   - A single IntersectionObserver rooted on the CHAT SCROLLER (not the
 *     browser viewport). Rows Virtuoso pre-mounts in its 600px overscan sit
 *     outside the scroller's clip box, so `isIntersecting` is false for them
 *     — mounting a bubble is NOT the same as seeing it, which is the whole
 *     point (marking overscan rows "seen" would recreate the over-clearing
 *     bug in a new form).
 *   - Every moving part is a ref, never React state: the seen accumulator and
 *     the reaction index are written from the observer callback on scroll and
 *     must not re-render the bubble list (see the same rule in
 *     `useReadStatusManagement` / `useScrollManagement`).
 *   - A "seen" event is ignored unless the message has an UNREAD reaction
 *     activity (the prebuilt index lookup is O(1)), so the overwhelming
 *     majority of scrolled bubbles cost nothing and never schedule a flush.
 *   - Matched ids are batched over a throttle window (mirroring the
 *     500ms main / 1000ms thread precedent) and cleared in one
 *     `markFilteredAsRead` call — one `read-batch` PUT for a scroll-up burst,
 *     not one PUT per bubble.
 *
 * The clear reuses `markFilteredAsRead` wholesale: it PUTs the unread ids to
 * `/api/v3/activities/read-batch/` (server-side `is_read=True`, so other
 * devices pick it up on the next `refreshAllData` full reload), flips the
 * rows in `useCM.activityMessages`, persists them to IDB, and re-derives the
 * unread badge.
 */
import { useCallback, useEffect, useRef } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ActivityMessageProps } from "../../../types/chat";
import { buildReactionSeenIndex, clearableRowsForIds } from "../utils/reactionSeenMatch";
import { useMarkFilteredActivityRead } from "./useMarkFilteredActivityRead";

// How long a matched-reaction batch accumulates before it flushes. Mirrors
// the read-status throttle precedent (main pane updates twice as often as
// thread panes) so a fast scroll-up debounces into one `read-batch` PUT.
const MAIN_FLUSH_MS = 500;
const THREAD_FLUSH_MS = 1000;

// Any part of the bubble inside the scroller counts as "seen". A ratio
// threshold would wrongly withhold "seen" from a bubble taller than the
// viewport (a large image can never reach, say, 0.5) — and overscan rows are
// already excluded by the scroller root, which is where the real
// over-clearing risk lives. A tiny non-zero value avoids firing on a
// zero-area edge touch. Tunable if product wants a stricter "seen".
const SEEN_THRESHOLD = 0.01;

interface UseReactionSeenClearParams {
    useCM: ChatManagementState;
    isThread: boolean;
    // Optional per-row "this bubble was actually seen" signal. Invoked with the
    // row's `data-msg-key` (the v3 message UUID) the moment a row crosses into
    // the scroller viewport — the SAME true-seen event this hook already uses to
    // clear reaction activities, reused to advance the read cursor precisely
    // (see `useReadStatusManagement.handleSeenIndex`). Kept optional so the
    // reaction-clear behaviour stands alone if a host doesn't wire read-status.
    onMessageSeen?: (messageUuid: string) => void;
}

interface UseReactionSeenClearResult {
    /** Stable ref callback for each rendered `chat-msg-row`. Attaches the
     *  row to the observer (React 19 ref-cleanup unobserves on unmount).
     *  Stable identity so it never busts the memoized `itemContent`. */
    rowRef: (el: HTMLElement | null) => (() => void) | void;
    /** Merge into the renderer's existing `scrollerRef` so the observer can
     *  root on the chat scroller. Recreates the observer per scroller (i.e.
     *  per chat, since Virtuoso remounts on chat switch). */
    registerScroller: (el: HTMLElement | null) => void;
}

export const useReactionSeenClear = ({
    useCM,
    isThread,
    onMessageSeen,
}: UseReactionSeenClearParams): UseReactionSeenClearResult => {
    const { markFilteredAsRead } = useMarkFilteredActivityRead({ useCM });

    // Held in a ref so the stable observer closure always calls the latest
    // callback without being rebuilt (same pattern as `onSeenRef` below).
    const onMessageSeenRef = useRef(onMessageSeen);
    onMessageSeenRef.current = onMessageSeen;

    // messageUUID → [unread reaction activityId]. Rebuilt only when the
    // activity store changes, never on scroll.
    const indexRef = useRef<Map<string, string[]>>(new Map());
    useEffect(() => {
        indexRef.current = buildReactionSeenIndex(useCM.activityMessages);
        // A reaction can land on a bubble the user is ALREADY looking at (the
        // common case: reacting to a message someone is actively reading). The
        // observer only fires on viewport-entry transitions, so that bubble
        // emits no callback and its row (stable key, no remount) is never
        // re-observed — the reaction would sit unread until a scroll or chat
        // switch. Replay every currently-visible row through the (now
        // freshly-indexed) match path so an in-view reaction clears at once.
        // Cheap: runs only on store change, and each `onSeen` is an O(1) index
        // lookup that no-ops unless that bubble has an unread reaction.
        for (const rowEl of visibleRowsRef.current) {
            const key = rowEl.dataset.msgKey;
            if (key) onSeenRef.current(key);
        }
    }, [useCM.activityMessages]);

    // Latest store snapshot + clear fn, read at flush time. Held in refs so
    // the observer callback (a stable closure) always sees current values
    // without being rebuilt.
    const activityMessagesRef = useRef<ActivityMessageProps[]>(useCM.activityMessages);
    activityMessagesRef.current = useCM.activityMessages;
    const markFilteredAsReadRef = useRef(markFilteredAsRead);
    markFilteredAsReadRef.current = markFilteredAsRead;

    // Reaction activityIds seen but not yet flushed.
    const pendingRef = useRef<Set<string>>(new Set());
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flush = useCallback(() => {
        flushTimerRef.current = null;
        const pending = pendingRef.current;
        if (pending.size === 0) return;
        pendingRef.current = new Set();
        // Re-validate against the LATEST store: an id cleared between the
        // "seen" event and this flush (sidebar click, cross-tab bridge) is
        // dropped, and `markFilteredAsRead` no-ops on an empty set — so the
        // endpoint's empty-list 400 branch is never hit.
        const rows = clearableRowsForIds(pending, activityMessagesRef.current);
        if (rows.length > 0) markFilteredAsReadRef.current(rows);
    }, []);

    // Throttle-with-trailing: the first matched "seen" arms a timer; further
    // matches within the window pile into the same batch. Bounded latency
    // (never longer than one window), unlike a reset-on-each-event debounce
    // that a continuous scroll could postpone indefinitely.
    const flushMs = isThread ? THREAD_FLUSH_MS : MAIN_FLUSH_MS;
    const onSeen = useCallback(
        (messageUuid: string) => {
            const ids = indexRef.current.get(messageUuid);
            if (!ids || ids.length === 0) return; // gate: no unread reaction here
            let added = false;
            for (const id of ids) {
                if (!pendingRef.current.has(id)) {
                    pendingRef.current.add(id);
                    added = true;
                }
            }
            if (added && flushTimerRef.current == null) {
                flushTimerRef.current = setTimeout(flush, flushMs);
            }
        },
        [flush, flushMs]
    );
    const onSeenRef = useRef(onSeen);
    onSeenRef.current = onSeen;

    // The observer, the scroller it's rooted on, and the set of every row
    // currently mounted. `liveRowsRef` is the source of truth for what to
    // observe: rows land here whether or not the observer exists yet (row
    // refs fire child-first, BEFORE the scroller ref that builds the
    // observer), and — crucially — they STAY here after being observed. So if
    // the observer is ever rebuilt (chat switch, or a host that re-invokes
    // the scroller ref), every live row is re-observed against the new
    // observer instead of being silently lost.
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollerElRef = useRef<HTMLElement | null>(null);
    const liveRowsRef = useRef<Set<HTMLElement>>(new Set());
    // Rows CURRENTLY inside the scroller (isIntersecting true), maintained by
    // the observer callback. Distinct from liveRowsRef (all mounted rows):
    // this is only the on-screen subset. It exists so a reaction that lands on
    // a bubble ALREADY in view gets cleared without waiting for a scroll — the
    // observer fires on threshold crossings only, so a chip appearing under an
    // already-visible bubble emits no callback, and the row (stable key, no
    // remount) is never re-observed. See the index-rebuild replay below.
    const visibleRowsRef = useRef<Set<HTMLElement>>(new Set());

    const registerScroller = useCallback((el: HTMLElement | null) => {
        // Same scroller as last time → nothing to do. Guards against a host
        // that re-invokes the scroller ref with an unchanged element (e.g.
        // Virtuoso republishing an inline-arrow `scrollerRef` on every
        // render): rebuilding here would drop every observation until the
        // next row remount.
        if (el === scrollerElRef.current) return;
        // Tear down the previous chat's observer (also unobserves everything).
        observerRef.current?.disconnect();
        observerRef.current = null;
        // The old observer's visibility reports are void now; the new observer
        // re-fires an initial callback per observed row and repopulates this.
        visibleRowsRef.current.clear();
        scrollerElRef.current = el;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const target = entry.target as HTMLElement;
                    if (!entry.isIntersecting) {
                        visibleRowsRef.current.delete(target);
                        continue;
                    }
                    visibleRowsRef.current.add(target);
                    const key = target.dataset.msgKey;
                    if (key) {
                        onSeenRef.current(key);
                        // Advance the read cursor for this genuinely-seen row.
                        // Only fired here (real viewport entry), never in the
                        // index-rebuild replay below — that replay exists to
                        // clear reactions on already-visible bubbles and must
                        // not re-mark rows the cursor already passed.
                        onMessageSeenRef.current?.(key);
                    }
                }
            },
            { root: el, threshold: SEEN_THRESHOLD }
        );
        observerRef.current = io;
        // Re-observe every currently-mounted row (not just ones that queued
        // before this observer existed) — this is what makes a rebuild safe.
        for (const rowEl of liveRowsRef.current) io.observe(rowEl);
    }, []);

    const rowRef = useCallback((el: HTMLElement | null) => {
        if (!el) return;
        liveRowsRef.current.add(el);
        observerRef.current?.observe(el);
        return () => {
            liveRowsRef.current.delete(el);
            visibleRowsRef.current.delete(el);
            observerRef.current?.unobserve(el);
        };
    }, []);

    // Drop any armed flush on unmount so it can't fire against a torn-down
    // pane. Disconnect the observer too (belt-and-braces with the null
    // scroller-ref call React makes on unmount).
    useEffect(() => {
        return () => {
            if (flushTimerRef.current != null) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            observerRef.current?.disconnect();
            observerRef.current = null;
            scrollerElRef.current = null;
        };
    }, []);

    return { registerScroller, rowRef };
};
