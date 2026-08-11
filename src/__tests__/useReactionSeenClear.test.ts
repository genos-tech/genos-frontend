// @vitest-environment jsdom
//
// Reaction-seen clear hook (src/features/chat/hooks/useReactionSeenClear.ts).
// Drives a controllable IntersectionObserver + fake timers to prove:
//  - a seen bubble with an unread reaction schedules a debounced batch clear
//  - a seen bubble with NO unread reaction costs nothing (no clear)
//  - overscan-mounted rows never count (the hook only reacts to
//    `isIntersecting` entries, which the scroller root withholds)
//  - a burst of seen bubbles collapses into ONE clear call
//  - an id cleared between "seen" and flush is dropped (re-validation)
//  - rows observed before the scroller lands are still picked up

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import AFTER the mock is registered.
import { useReactionSeenClear } from "../features/chat/hooks/useReactionSeenClear";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { ActivityMessageProps } from "../types/chat";

const markFilteredAsRead = vi.fn();
vi.mock("../features/chat/hooks/useMarkFilteredActivityRead", () => ({
    useMarkFilteredActivityRead: () => ({ markFilteredAsRead }),
}));

// ---- Controllable IntersectionObserver -----------------------------------
type MockEntry = { target: Element; isIntersecting: boolean };
class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];
    cb: IntersectionObserverCallback;
    root: Element | Document | null;
    observed = new Set<Element>();
    disconnected = false;
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        this.cb = cb;
        this.root = (opts?.root as Element) ?? null;
        MockIntersectionObserver.instances.push(this);
    }
    observe(el: Element) {
        this.observed.add(el);
    }
    unobserve(el: Element) {
        this.observed.delete(el);
    }
    disconnect() {
        this.observed.clear();
        this.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    /** test-only: fire the callback with the given entries. Models the real
     *  IntersectionObserver contract — entries are delivered ONLY for targets
     *  currently observed, so an unobserved/disconnected node never reports. */
    fire(entries: MockEntry[]) {
        const live = entries.filter((e) => this.observed.has(e.target));
        if (live.length === 0) return;
        this.cb(
            live as unknown as IntersectionObserverEntry[],
            this as unknown as IntersectionObserver
        );
    }
    static latest() {
        return this.instances[this.instances.length - 1];
    }
}

function reaction(overrides: Partial<ActivityMessageProps> = {}): ActivityMessageProps {
    return {
        activityId: "r1",
        activityType: 2,
        chatType: 2,
        chatId: 0,
        chatName: "GM",
        dmPartnerUserId: "",
        dmPartnerUserName: "",
        dmPartnerUserEmail: "",
        isThread: false,
        threadId: 0,
        messageId: 0,
        messageUniqueKey: "m1",
        threadMessageUniqueKey: "",
        taskId: 0,
        firstLineContent: "hi",
        latestReaction: { emoji: "👍", sender: {} as never, tsSent: "" },
        senderId: "author",
        receiver: {} as never,
        reactions: [],
        tsSent: "2026-01-01T00:00:00Z",
        isRead: false,
        ...overrides,
    };
}

const cm = (activityMessages: ActivityMessageProps[]): ChatManagementState =>
    ({ activityMessages }) as unknown as ChatManagementState;

function row(msgKey: string): HTMLElement {
    const el = document.createElement("div");
    el.dataset.msgKey = msgKey;
    return el;
}

let realIO: typeof IntersectionObserver;

beforeEach(() => {
    vi.useFakeTimers();
    markFilteredAsRead.mockClear();
    MockIntersectionObserver.instances = [];
    realIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
        MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
    globalThis.IntersectionObserver = realIO;
    vi.useRealTimers();
});

describe("useReactionSeenClear", () => {
    it("clears an unread reaction when its bubble is seen (after the flush window)", () => {
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ activityId: "r1", messageUniqueKey: "m1" })]),
            })
        );

        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });

        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );
        // Not yet — batched.
        expect(markFilteredAsRead).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
        expect(
            markFilteredAsRead.mock.calls[0][0].map((r: ActivityMessageProps) => r.activityId)
        ).toEqual(["r1"]);
    });

    it("does nothing for a bubble that has no unread reaction", () => {
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("unrelated");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });

        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );
        act(() => vi.advanceTimersByTime(1000));
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    it("clears a reaction that lands on a bubble ALREADY in view (no scroll needed)", () => {
        // The common case: the user is looking at message M when a colleague
        // reacts to it. The observer fires only on viewport-entry transitions,
        // so an already-visible M emits no callback and (stable key, no
        // remount) is never re-observed. Without a replay on index rebuild the
        // reaction would sit unread until a scroll / chat switch. Here the
        // store starts with NO reaction; M is already intersecting; then the
        // reaction arrives (store update) and must clear immediately.
        const before: ActivityMessageProps[] = [];
        const { result, rerender } = renderHook(
            ({ store }: { store: ActivityMessageProps[] }) =>
                useReactionSeenClear({ isThread: false, useCM: cm(store) }),
            { initialProps: { store: before } }
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        // M enters the viewport BEFORE any reaction exists: onSeen no-ops
        // (empty index) but the row is recorded as visible.
        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );
        expect(markFilteredAsRead).not.toHaveBeenCalled();

        // The reaction arrives while M is still on screen — no new IO callback.
        act(() =>
            rerender({
                store: [reaction({ activityId: "r1", messageUniqueKey: "m1" })],
            })
        );
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
        expect(
            markFilteredAsRead.mock.calls[0][0].map((r: ActivityMessageProps) => r.activityId)
        ).toEqual(["r1"]);
    });

    it("does NOT clear a reaction on a bubble scrolled OUT of view when it lands", () => {
        // Mirror of the above: a row that left the viewport is removed from the
        // visible set, so a reaction arriving on it is not replayed/cleared —
        // the user isn't looking at it.
        const { result, rerender } = renderHook(
            ({ store }: { store: ActivityMessageProps[] }) =>
                useReactionSeenClear({ isThread: false, useCM: cm(store) }),
            { initialProps: { store: [] as ActivityMessageProps[] } }
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        // Seen, then scrolled away.
        act(() => {
            const io = MockIntersectionObserver.latest();
            io.fire([{ target: rowEl, isIntersecting: true }]);
            io.fire([{ target: rowEl, isIntersecting: false }]);
        });
        act(() =>
            rerender({
                store: [reaction({ activityId: "r1", messageUniqueKey: "m1" })],
            })
        );
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    it("ignores non-intersecting (overscan-mounted) rows", () => {
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });

        // The observer MUST be rooted on the chat scroller, not the browser
        // viewport — that root is the ONLY thing that keeps Virtuoso's 600px
        // overscan-mounted rows (outside the scroller's clip box) from being
        // reported as intersecting and wrongly cleared. jsdom can't model real
        // root clipping, so assert the construction arg directly: dropping
        // `root` (root = viewport) would revive the over-clearing bug and this
        // catches it.
        expect(MockIntersectionObserver.latest().root).toBe(scroller);

        // Mounted but off-screen: isIntersecting false.
        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: false }])
        );
        act(() => vi.advanceTimersByTime(1000));
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    it("collapses a scroll-up burst of seen bubbles into one clear call", () => {
        const store = [
            reaction({ activityId: "r1", messageUniqueKey: "m1" }),
            reaction({ activityId: "r2", messageUniqueKey: "m2" }),
        ];
        const { result } = renderHook(() =>
            useReactionSeenClear({ isThread: false, useCM: cm(store) })
        );
        const scroller = document.createElement("div");
        const a = row("m1");
        const b = row("m2");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(a);
            result.current.rowRef(b);
        });

        act(() => {
            const io = MockIntersectionObserver.latest();
            io.fire([{ target: a, isIntersecting: true }]);
            io.fire([{ target: b, isIntersecting: true }]);
        });
        act(() => vi.advanceTimersByTime(500));

        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
        expect(
            markFilteredAsRead.mock.calls[0][0]
                .map((r: ActivityMessageProps) => r.activityId)
                .sort()
        ).toEqual(["r1", "r2"]);
    });

    it("does NOT reset the flush timer on a later match (throttle, not debounce)", () => {
        // The burst test proves batching but not WHICH batching. A
        // reset-on-each-event debounce would postpone the flush indefinitely
        // under a continuous scroll. This proves bounded latency: a match
        // arriving mid-window still flushes at the ORIGINAL deadline, and the
        // second id rides the same batch.
        const store = [
            reaction({ activityId: "r1", messageUniqueKey: "m1" }),
            reaction({ activityId: "r2", messageUniqueKey: "m2" }),
        ];
        const { result } = renderHook(() =>
            useReactionSeenClear({ isThread: false, useCM: cm(store) })
        );
        const scroller = document.createElement("div");
        const a = row("m1");
        const b = row("m2");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(a);
            result.current.rowRef(b);
        });

        const io = MockIntersectionObserver.latest();
        // First match arms the timer at t=0 (deadline t=500).
        act(() => io.fire([{ target: a, isIntersecting: true }]));
        // Second match at t=300 — a debounce would push the deadline to t=800.
        act(() => vi.advanceTimersByTime(300));
        act(() => io.fire([{ target: b, isIntersecting: true }]));

        // At t=500 (original deadline) it MUST flush. A debounce would not.
        act(() => vi.advanceTimersByTime(200));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
        // Both ids rode the one batch (the trailing match wasn't lost).
        expect(
            markFilteredAsRead.mock.calls[0][0]
                .map((r: ActivityMessageProps) => r.activityId)
                .sort()
        ).toEqual(["r1", "r2"]);
    });

    it("drops an id already read by flush time (re-validation against latest store)", () => {
        const unread = [reaction({ activityId: "r1", messageUniqueKey: "m1", isRead: false })];
        const { result, rerender } = renderHook(
            ({ store }: { store: ActivityMessageProps[] }) =>
                useReactionSeenClear({ isThread: false, useCM: cm(store) }),
            { initialProps: { store: unread } }
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );

        // Another path (sidebar click / cross-tab) marks it read before flush.
        rerender({
            store: [reaction({ activityId: "r1", messageUniqueKey: "m1", isRead: true })],
        });
        act(() => vi.advanceTimersByTime(500));

        // Nothing left to clear → no-op (never hits the empty-list endpoint).
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    it("observes rows that mounted before the scroller ref landed", () => {
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ messageUniqueKey: "m1" })]),
            })
        );
        const rowEl = row("m1");
        // Row ref fires child-first, BEFORE the scroller ref in the real tree.
        act(() => result.current.rowRef(rowEl));
        const scroller = document.createElement("div");
        act(() => result.current.registerScroller(scroller));

        const io = MockIntersectionObserver.latest();
        expect(io.observed.has(rowEl)).toBe(true);
        act(() => io.fire([{ target: rowEl, isIntersecting: true }]));
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
    });

    it("keeps observing live rows when the scroller ref is re-invoked with the SAME element", () => {
        // Virtuoso republishes an inline-arrow scrollerRef every render and
        // re-runs its scroll-setup effect (null, then element) on identity
        // change. A naive rebuild would drop already-observed rows. The hook
        // no-ops on the same element, so the original observer stays live.
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ activityId: "r1", messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        const firstIo = MockIntersectionObserver.latest();

        // Host re-invokes the scroller ref with the SAME element.
        act(() => result.current.registerScroller(scroller));
        // No new observer built, old one not disconnected, row still observed.
        expect(MockIntersectionObserver.latest()).toBe(firstIo);
        expect(firstIo.disconnected).toBe(false);
        expect(firstIo.observed.has(rowEl)).toBe(true);

        act(() => firstIo.fire([{ target: rowEl, isIntersecting: true }]));
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
    });

    it("re-observes live rows on a genuine scroller swap (chat switch)", () => {
        // A real remount/chat-switch hands a NEW scroller element. The old
        // observer is torn down and every still-mounted row is re-observed
        // against the new one (rows persist in the live set, they aren't
        // consumed by the first registration).
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ activityId: "r1", messageUniqueKey: "m1" })]),
            })
        );
        const first = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(first);
            result.current.rowRef(rowEl);
        });
        const firstIo = MockIntersectionObserver.latest();

        const second = document.createElement("div");
        act(() => result.current.registerScroller(second));
        const secondIo = MockIntersectionObserver.latest();

        expect(secondIo).not.toBe(firstIo);
        expect(firstIo.disconnected).toBe(true);
        // The live row is picked up by the new observer without a remount.
        expect(secondIo.observed.has(rowEl)).toBe(true);
        act(() => secondIo.fire([{ target: rowEl, isIntersecting: true }]));
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
    });

    it("uses the slower thread flush window", () => {
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: true,
                useCM: cm([reaction({ messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );

        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).not.toHaveBeenCalled(); // 500ms < thread 1000ms
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
    });

    it("cancels an armed flush on unmount (no clear against a torn-down pane)", () => {
        // A reacted-to bubble is seen, arming the flush, then the pane closes
        // within the window (chat switch / thread close). The unmount cleanup
        // MUST clear the timer so it can't fire markFilteredAsRead against a
        // dead component.
        const { result, unmount } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ activityId: "r1", messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        act(() => {
            result.current.registerScroller(scroller);
            result.current.rowRef(rowEl);
        });
        act(() =>
            MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
        );
        const io = MockIntersectionObserver.latest();

        // Unmount BEFORE the window elapses.
        unmount();
        // The observer is disconnected and the pending timer is dropped.
        expect(io.disconnected).toBe(true);
        act(() => vi.advanceTimersByTime(1000));
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    it("unobserves a row when its ref-cleanup runs (row unmounted / recycled)", () => {
        // React 19 calls the ref cleanup when a row leaves the tree (Virtuoso
        // recycles rows on scroll). That cleanup must unobserve the element so
        // a recycled node can't keep firing "seen".
        const { result } = renderHook(() =>
            useReactionSeenClear({
                isThread: false,
                useCM: cm([reaction({ activityId: "r1", messageUniqueKey: "m1" })]),
            })
        );
        const scroller = document.createElement("div");
        const rowEl = row("m1");
        let cleanup: (() => void) | void;
        act(() => {
            result.current.registerScroller(scroller);
            cleanup = result.current.rowRef(rowEl);
        });
        const io = MockIntersectionObserver.latest();
        expect(io.observed.has(rowEl)).toBe(true);

        // Row leaves the tree.
        act(() => cleanup?.());
        expect(io.observed.has(rowEl)).toBe(false);

        // A stale entry replayed for the removed node clears nothing.
        act(() => io.fire([{ target: rowEl, isIntersecting: true }]));
        act(() => vi.advanceTimersByTime(500));
        expect(markFilteredAsRead).not.toHaveBeenCalled();
    });

    // ---- onMessageSeen: the read-cursor signal ---------------------------
    // The same true-seen event that clears reactions is also forwarded to
    // read-status (`onMessageSeen` → the pane's `handleSeenIndex`). These
    // prove it fires on genuine viewport entry, unconditionally (a plain
    // message with no reaction still advances the cursor), never for overscan
    // rows, and never from the reaction-only index-rebuild replay.
    describe("onMessageSeen", () => {
        it("fires with the row key when a bubble genuinely enters the viewport", () => {
            const onMessageSeen = vi.fn();
            const { result } = renderHook(() =>
                useReactionSeenClear({ isThread: false, onMessageSeen, useCM: cm([]) })
            );
            const scroller = document.createElement("div");
            const rowEl = row("m1");
            act(() => {
                result.current.registerScroller(scroller);
                result.current.rowRef(rowEl);
            });

            // A bare message with NO unread reaction: reaction-clear stays
            // silent, but the cursor signal still fires (it's unconditional —
            // seeing any bubble advances read status).
            act(() =>
                MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
            );
            expect(onMessageSeen).toHaveBeenCalledTimes(1);
            expect(onMessageSeen).toHaveBeenCalledWith("m1");
            expect(markFilteredAsRead).not.toHaveBeenCalled();
        });

        it("does NOT fire for a non-intersecting (overscan-mounted) row", () => {
            const onMessageSeen = vi.fn();
            const { result } = renderHook(() =>
                useReactionSeenClear({ isThread: false, onMessageSeen, useCM: cm([]) })
            );
            const scroller = document.createElement("div");
            const rowEl = row("m1");
            act(() => {
                result.current.registerScroller(scroller);
                result.current.rowRef(rowEl);
            });
            act(() =>
                MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: false }])
            );
            expect(onMessageSeen).not.toHaveBeenCalled();
        });

        it("does NOT fire from the reaction index-rebuild replay", () => {
            // The store-change replay exists to clear reactions on bubbles that
            // are ALREADY on screen; it must not re-advance the read cursor
            // (those rows were seen — and marked read — on their real entry).
            // Verify the replay path drives reaction clearing but leaves the
            // cursor signal untouched.
            const onMessageSeen = vi.fn();
            const { result, rerender } = renderHook(
                ({ store }: { store: ActivityMessageProps[] }) =>
                    useReactionSeenClear({ isThread: false, onMessageSeen, useCM: cm(store) }),
                { initialProps: { store: [] as ActivityMessageProps[] } }
            );
            const scroller = document.createElement("div");
            const rowEl = row("m1");
            act(() => {
                result.current.registerScroller(scroller);
                result.current.rowRef(rowEl);
            });
            // Real entry: cursor signal fires once.
            act(() =>
                MockIntersectionObserver.latest().fire([{ target: rowEl, isIntersecting: true }])
            );
            expect(onMessageSeen).toHaveBeenCalledTimes(1);
            onMessageSeen.mockClear();

            // A reaction now lands on the still-visible bubble (store update →
            // index rebuild + replay). Reaction clears, but the cursor signal
            // must NOT fire again from the replay.
            act(() =>
                rerender({ store: [reaction({ activityId: "r1", messageUniqueKey: "m1" })] })
            );
            act(() => vi.advanceTimersByTime(500));
            expect(markFilteredAsRead).toHaveBeenCalledTimes(1);
            expect(onMessageSeen).not.toHaveBeenCalled();
        });

        it("fires once per row across a multi-row burst", () => {
            const onMessageSeen = vi.fn();
            const { result } = renderHook(() =>
                useReactionSeenClear({ isThread: false, onMessageSeen, useCM: cm([]) })
            );
            const scroller = document.createElement("div");
            const a = row("m1");
            const b = row("m2");
            act(() => {
                result.current.registerScroller(scroller);
                result.current.rowRef(a);
                result.current.rowRef(b);
            });
            act(() => {
                const io = MockIntersectionObserver.latest();
                io.fire([
                    { target: a, isIntersecting: true },
                    { target: b, isIntersecting: true },
                ]);
            });
            expect(onMessageSeen.mock.calls.map((c) => c[0]).sort()).toEqual(["m1", "m2"]);
        });
    });
});
