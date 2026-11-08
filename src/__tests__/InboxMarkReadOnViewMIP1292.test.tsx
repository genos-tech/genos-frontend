/**
 * MIP-1292: a Genos report counts as read once its card has been on screen for 2 s.
 *
 * genos-api folds "N unchanged since your last report" only over a previous report the member
 * opened, and nothing ever set `is_read` on a report. The card now sends
 * `PUT /inbox/ {team_id, item_id, is_read: true}` once per item after the dwell. The observer
 * is driven by hand and the clock by fake timers: layout is not testable in jsdom.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { DWELL_MS, resetReportReadScheduler } from "../features/inbox/reportReadScheduler";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { InboxItemProps } from "../types/common";

const put = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());
vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { put } : null),
}));
vi.mock("../db/workers/channels", () => ({
    inboxChannel: { request },
}));
vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

// ---- a hand-driven IntersectionObserver ----------------------------------------------------
type Report = {
    isIntersecting: boolean;
    intersectionRatio: number;
    intersectionRect?: { height: number };
    rootBounds?: { height: number } | null;
};
class MockIO {
    static instances: MockIO[] = [];
    observed = new Set<Element>();
    disconnected = false;
    thresholds: number[];
    constructor(
        private cb: IntersectionObserverCallback,
        opts?: IntersectionObserverInit
    ) {
        this.thresholds = [opts?.threshold ?? 0].flat();
        MockIO.instances.push(this);
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
    takeRecords() {
        return [];
    }
    /** Deliver one report per target; a target that is not observed never reports. */
    report(target: Element, r: Report) {
        if (!this.observed.has(target)) return;
        this.cb(
            [
                {
                    target,
                    isIntersecting: r.isIntersecting,
                    intersectionRatio: r.intersectionRatio,
                    intersectionRect: r.intersectionRect ?? { height: 0 },
                    rootBounds: r.rootBounds === undefined ? { height: 800 } : r.rootBounds,
                } as unknown as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver
        );
    }
    static live() {
        return MockIO.instances.filter((o) => !o.disconnected);
    }
}
const cards = () => [...document.querySelectorAll('[data-bubble-layout="bubble"]')];
const see = (el: Element, ratio = 1) =>
    act(() => MockIO.live()[0].report(el, { isIntersecting: true, intersectionRatio: ratio }));
const leave = (el: Element) =>
    act(() => MockIO.live()[0].report(el, { isIntersecting: false, intersectionRatio: 0 }));
const tick = async (ms: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};
const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
};

let realIO: typeof IntersectionObserver;
beforeEach(() => {
    vi.useFakeTimers();
    put.mockReset().mockResolvedValue({ data: {} });
    request.mockReset().mockResolvedValue(undefined);
    MockIO.instances = [];
    realIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
    setHidden(false);
});
afterEach(() => {
    resetReportReadScheduler();
    globalThis.IntersectionObserver = realIO;
    vi.useRealTimers();
});

// ---- rendering -----------------------------------------------------------------------------
const item = (over: Partial<InboxItemProps> = {}): InboxItemProps =>
    ({
        itemId: 10,
        itemType: 10,
        itemBody: { title: "What to do today", text: "Two tasks.", sections: [] } as never,
        isRead: false,
        requestStatus: "" as never,
        tsSent: "2026-11-09T00:00:00Z",
        itemOptionals: { kind: "schedule_report", schedule_id: "s1", job: "what_to_do_today" },
        ...over,
    }) as InboxItemProps;

const Bubble = ({ it, teamId = "t1" }: { it: InboxItemProps; teamId?: string }) => (
    <CssVarsProvider>
        <MemoryRouter>
            <UrlLinkModalProvider value={{ openModalByHref: vi.fn() }}>
                <InboxBubble
                    inboxItem={it}
                    myself={{ userId: "u1", teamId } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </UrlLinkModalProvider>
        </MemoryRouter>
    </CssVarsProvider>
);
const renderCards = (...items: InboxItemProps[]) =>
    render(
        <>
            {items.map((it) => (
                <Bubble key={it.itemId} it={it} />
            ))}
        </>
    );

describe("a Genos report is marked read once it has been on screen", () => {
    it("sends nothing on render, nothing before the dwell, then one PUT with exactly the pinned body", async () => {
        renderCards(item());
        const [card] = cards();
        await tick(10_000);
        expect(put).not.toHaveBeenCalled(); // list load alone never counts
        see(card);
        await tick(DWELL_MS - 1);
        expect(put).not.toHaveBeenCalled();
        await tick(1);
        expect(put).toHaveBeenCalledTimes(1);
        // The body genos-api's `test_mark_read_alone_still_works` pins; silent on failure.
        expect(put).toHaveBeenCalledWith(
            "/inbox/",
            { team_id: "t1", item_id: 10, is_read: true },
            { suppressErrorToast: true }
        );
    });

    it("patches only isRead on the stored row, through the inbox worker", async () => {
        renderCards(item());
        see(cards()[0]);
        await tick(DWELL_MS);
        expect(request).toHaveBeenCalledWith("markInboxItemsRead", { itemIds: [10] });
    });

    it("cancels when the card scrolls away before the dwell, and the clock restarts on return", async () => {
        renderCards(item());
        const [card] = cards();
        see(card);
        await tick(1900);
        leave(card);
        await tick(5000);
        expect(put).not.toHaveBeenCalled();
        see(card);
        await tick(1900);
        expect(put).not.toHaveBeenCalled(); // not 1.9 + 1.9: the first look was cancelled
        await tick(100);
        expect(put).toHaveBeenCalledTimes(1);
    });

    it("does not count a card that is only 20% in view", async () => {
        renderCards(item());
        see(cards()[0], 0.2);
        await tick(10_000);
        expect(put).not.toHaveBeenCalled();
    });

    it("counts a card taller than the viewport once it fills half of it", async () => {
        renderCards(item());
        const [card] = cards();
        // 30% of the card, but 500 of the 800 px of the viewport.
        act(() =>
            MockIO.live()[0].report(card, {
                isIntersecting: true,
                intersectionRatio: 0.3,
                intersectionRect: { height: 500 },
                rootBounds: { height: 800 },
            })
        );
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(1);
    });

    it("restarts the clock while the tab is hidden, and counts again on return", async () => {
        renderCards(item());
        const [card] = cards();
        see(card);
        await tick(1500);
        setHidden(true);
        await tick(60_000);
        expect(put).not.toHaveBeenCalled();
        setHidden(false);
        await tick(1900);
        expect(put).not.toHaveBeenCalled();
        await tick(100);
        expect(put).toHaveBeenCalledTimes(1);
    });

    it("does not start the clock for a card that came into view in a hidden tab", async () => {
        renderCards(item());
        setHidden(true);
        see(cards()[0]);
        await tick(60_000);
        expect(put).not.toHaveBeenCalled();
    });

    it("sends once, however often the card leaves, returns or remounts", async () => {
        const first = renderCards(item());
        see(cards()[0]);
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(1);
        expect(MockIO.live()).toHaveLength(0); // sent: the card is no longer watched
        first.unmount();
        // Virtuoso recycles the row: a fresh mount of the same, still unread-in-memory item.
        renderCards(item());
        expect(MockIO.live()).toHaveLength(0); // already claimed: nothing is even observed
        await tick(10_000);
        expect(put).toHaveBeenCalledTimes(1);
    });

    it("sends once when the same report is mounted twice", async () => {
        render(
            <>
                <Bubble it={item()} />
                <Bubble it={item()} />
            </>
        );
        for (const card of cards()) see(card);
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(1);
    });

    it("keeps a failure silent, then tries again the next time the card enters the view", async () => {
        put.mockRejectedValueOnce({ response: { status: 500 } });
        renderCards(item());
        const [card] = cards();
        see(card);
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(1);
        expect(request).not.toHaveBeenCalled(); // nothing was stored as read
        await tick(10_000);
        expect(put).toHaveBeenCalledTimes(1); // no retry while it just sits there
        leave(card);
        see(card);
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("does nothing for a report that is already read", async () => {
        renderCards(item({ isRead: true }));
        expect(MockIO.live()).toHaveLength(0);
        await tick(10_000);
        expect(put).not.toHaveBeenCalled();
    });

    it("leaves every other item type alone (activity, requests, digest, reminder)", async () => {
        for (const itemType of [0, 1, 6, 9]) {
            const { unmount } = renderCards(item({ itemId: 100 + itemType, itemType }));
            expect(MockIO.live()).toHaveLength(0);
            unmount();
        }
        await tick(10_000);
        expect(put).not.toHaveBeenCalled();
    });

    it("keeps one observer and one timer for a long list, and only a card on screen is due", async () => {
        const many = Array.from({ length: 100 }, (_, i) => item({ itemId: 1000 + i }));
        renderCards(...many);
        expect(MockIO.live()).toHaveLength(1);
        expect(MockIO.live()[0].observed.size).toBe(100);
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        see(cards()[3]);
        see(cards()[4]);
        await tick(DWELL_MS);
        expect(put).toHaveBeenCalledTimes(2);
        expect(put.mock.calls.map((c) => c[1].item_id).sort()).toEqual([1003, 1004]);
        // Two cards came into view; one timer was armed at a time, never one per card.
        expect(setTimeoutSpy.mock.calls.filter(([, ms]) => ms === DWELL_MS).length).toBeLessThan(
            3
        );
        setTimeoutSpy.mockRestore();
    });

    it("stops watching when the card unmounts before the dwell", async () => {
        const view = renderCards(item());
        see(cards()[0]);
        await tick(1000);
        view.unmount();
        await tick(10_000);
        expect(put).not.toHaveBeenCalled();
        expect(MockIO.live()).toHaveLength(0);
    });

    it("treats the same item id in another team as another item", async () => {
        render(
            <>
                <Bubble it={item()} teamId="t1" />
                <Bubble it={item()} teamId="t2" />
            </>
        );
        for (const card of cards()) see(card);
        await tick(DWELL_MS);
        expect(put.mock.calls.map((c) => c[1].team_id).sort()).toEqual(["t1", "t2"]);
    });
});

describe("a report card shown as a preview", () => {
    it("never watches or sends: only InboxBubble does, and a preview has no item", async () => {
        const { GenosReportCard } = await import("../features/inbox/components/GenosReportCard");
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <GenosReportCard
                        report={{ title: "Preview", text: "", sections: [], stats: [] } as never}
                    />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(MockIO.live()).toHaveLength(0);
        await tick(10_000);
        expect(put).not.toHaveBeenCalled();
    });
});
