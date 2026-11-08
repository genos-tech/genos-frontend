// The live path for an inbox item nobody's client created.
//
// Every other inbox row arrives live because the client whose request created
// it relays a `wsType: "inbox"` socket event. A reminder is filed by a backend
// cron, which has no client — so a fired reminder appeared in the inbox only
// after a reload. That was the reported bug: "when I refresh the page, then
// yes, I could see the todo items".
//
// `useInboxResync` closes it from the client side: the reminder sweep timer
// already knows when a reminder is due, and an arriving push is already
// correctly timed, so either one asks for a delta sync. These tests pin the
// behaviours that make that safe to run on a timer:
//
//   * repaint always, notify only for what's genuinely new AND recent;
//   * never notify twice for one reminder, including when the service worker
//     already showed a card for it;
//   * overlapping requests coalesce instead of stacking sync calls, because
//     the sweep and the push for one reminder land seconds apart.

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    INBOX_FOCUS_RESYNC_MS,
    markInboxSyncing,
    requestInboxResync,
} from "../features/inbox/inboxResyncEvent";
import { useInboxResync } from "../hooks/inbox/useInboxResync";
import { NotificationManager } from "../services/notifications/notificationManager";
import type { UserProps } from "../types/admin";
import type { InboxItemProps } from "../types/common";

// The real module imports `*.ts?worker`, which only Vite resolves — and we
// want to assert orchestration anyway (which requests fire, in what order).
// `popInboxItems` goes through this same channel, so one mock covers both.
vi.mock("../db/workers/channels", () => ({
    inboxChannel: { request: vi.fn() },
}));

const { inboxChannel } = await import("../db/workers/channels");
const request = inboxChannel.request as unknown as ReturnType<typeof vi.fn>;

const myself = { userId: "me", userName: "Me" } as unknown as UserProps;

// `stored` is what IndexedDB holds; `serverAdds` is what the next `loadInbox`
// will merge into it. That split is the whole point of the hook — the "before"
// snapshot has to come from storage, not from React state.
let stored: InboxItemProps[] = [];
let serverAdds: InboxItemProps[] = [];
let loadCount = 0;

const reminderRow = (
    id: number,
    optionals: Record<string, unknown> = {},
    dueMinutesAgo = 0
): InboxItemProps => {
    const due = new Date(Date.now() - dueMinutesAgo * 60_000).toISOString();
    return {
        itemId: id,
        itemBody: [],
        itemType: 9,
        isRead: false,
        requestStatus: "pending",
        tsSent: due,
        itemOptionals: {
            kind: "todo_reminder",
            reminder_id: String(id),
            preview: `To-do ${id}`,
            remind_at: due,
            ...optionals,
        },
    };
};

const joinRequestRow = (id: number): InboxItemProps => ({
    itemId: id,
    itemBody: [],
    itemType: 1,
    isRead: false,
    requestStatus: "pending",
    tsSent: new Date().toISOString(),
    itemOptionals: null,
});

const mount = () => {
    const manager = new NotificationManager({ currentUserId: "me" });
    const notify = vi.spyOn(manager, "notify");
    const setInboxItems = vi.fn();
    renderHook(() => useInboxResync(myself, "token-1", manager, setInboxItems));
    return { manager, notify, setInboxItems };
};

/** Ask for a resync and wait for the (async, un-awaitable) run to finish. */
const resyncAndSettle = async (deliveredTag?: string) => {
    const before = loadCount;
    requestInboxResync(deliveredTag ? "push" : "reminder-sweep", deliveredTag);
    await waitFor(() => expect(loadCount).toBeGreaterThan(before));
};

beforeEach(() => {
    vi.clearAllMocks();
    stored = [];
    serverAdds = [];
    loadCount = 0;
    request.mockImplementation(async (method: string) => {
        if (method === "popInboxItems") return stored;
        if (method === "loadInbox") {
            loadCount += 1;
            stored = [...stored, ...serverAdds];
            serverAdds = [];
            return undefined;
        }
        return undefined;
    });
});

describe("useInboxResync — the sync itself", () => {
    it("delta-syncs and repaints when asked", async () => {
        const { setInboxItems } = mount();
        stored = [joinRequestRow(1)];
        serverAdds = [reminderRow(2)];

        await resyncAndSettle();

        // The checkpointed `loadInbox`, not a full reload — the hook runs on a
        // timer, so the per-call cost is the difference between a live inbox
        // and a self-inflicted poll.
        await waitFor(() => expect(setInboxItems).toHaveBeenCalled());
        expect(request).toHaveBeenCalledWith("loadInbox", { myself, accessToken: "token-1" });
        expect(setInboxItems.mock.lastCall?.[0]).toHaveLength(2);
    });

    it("does nothing at all while signed out", async () => {
        const setInboxItems = vi.fn();
        renderHook(() => useInboxResync(myself, null, null, setInboxItems));

        requestInboxResync("reminder-sweep");
        await Promise.resolve();

        // No token means no authenticated request to make. Sweeps can fire
        // during the sign-out teardown, and a 401 storm is not a fix.
        expect(request).not.toHaveBeenCalled();
        expect(setInboxItems).not.toHaveBeenCalled();
    });

    it("keeps working after the token is refreshed", async () => {
        // The listener is installed once and reads its inputs through a ref,
        // precisely so a token change doesn't unsubscribe it. A reminder timer
        // fires exactly once — a teardown window would silently eat it.
        const setInboxItems = vi.fn();
        const { rerender } = renderHook(
            ({ token }: { token: string }) => useInboxResync(myself, token, null, setInboxItems),
            { initialProps: { token: "token-1" } }
        );
        rerender({ token: "token-2" });

        await resyncAndSettle();

        expect(request).toHaveBeenCalledWith("loadInbox", { myself, accessToken: "token-2" });
    });

    it("survives a failing sync without wedging later ones", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { setInboxItems } = mount();
        request.mockRejectedValueOnce(new Error("offline"));

        requestInboxResync("reminder-sweep");
        await waitFor(() => expect(warn).toHaveBeenCalled());

        // The `running` guard has to be released on the failure path too, or
        // one dropped connection would silence every later reminder.
        serverAdds = [reminderRow(3)];
        await resyncAndSettle();
        expect(setInboxItems).toHaveBeenCalled();
    });
});

describe("useInboxResync — which reminders get announced", () => {
    it("announces a reminder that just landed", async () => {
        const { notify } = mount();
        serverAdds = [reminderRow(7)];

        await resyncAndSettle();

        await waitFor(() => expect(notify).toHaveBeenCalled());
        expect(notify.mock.calls[0][0].id).toBe("todo_reminder:7");
    });

    it("stays quiet about rows that were already in storage", async () => {
        // Otherwise every sweep would re-announce the same reminder for as
        // long as it stayed within the freshness window.
        const { notify, setInboxItems } = mount();
        stored = [reminderRow(7)];

        await resyncAndSettle();

        await waitFor(() => expect(setInboxItems).toHaveBeenCalled());
        expect(notify).not.toHaveBeenCalled();
    });

    it("repaints a stale reminder but doesn't pop it", async () => {
        // A first sign-in pulls the whole recent inbox at once, so every row
        // reads as new. Without the freshness bound that's a notification per
        // historical reminder — and a reminder is a statement about *now*.
        const { notify, setInboxItems } = mount();
        serverAdds = [reminderRow(8, {}, 240)];

        await resyncAndSettle();

        await waitFor(() => expect(setInboxItems).toHaveBeenCalled());
        expect(setInboxItems.mock.lastCall?.[0]).toHaveLength(1);
        expect(notify).not.toHaveBeenCalled();
    });

    it("ignores new inbox rows that aren't reminders", async () => {
        // A join request arriving in the same delta already had its own live
        // socket event; announcing it here would double-notify.
        const { notify, setInboxItems } = mount();
        serverAdds = [joinRequestRow(9)];

        await resyncAndSettle();

        await waitFor(() => expect(setInboxItems).toHaveBeenCalled());
        expect(notify).not.toHaveBeenCalled();
    });

    it("announces each of several reminders that fired in one tick", async () => {
        // The cron drains a backlog in passes, so a batch is the normal shape
        // of a delta, not an edge case.
        const { notify } = mount();
        serverAdds = [reminderRow(10), reminderRow(11)];

        await resyncAndSettle();

        await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
        expect(notify.mock.calls.map((c) => c[0].id)).toEqual([
            "todo_reminder:10",
            "todo_reminder:11",
        ]);
    });
});

describe("useInboxResync — not double-notifying with the service worker", () => {
    it("skips its own card for a reminder the worker already showed", async () => {
        // The worker's card is the richer one (action buttons,
        // requireInteraction), so when a push has demonstrably arrived the
        // page defers to it — the shared tag would collapse them anyway, but
        // replacing a better card with a worse one is still a regression.
        const { notify, setInboxItems } = mount();
        serverAdds = [reminderRow(12)];

        await resyncAndSettle("todo_reminder:12");

        // Still synced and repainted — that's the half the push can't do.
        await waitFor(() => expect(setInboxItems).toHaveBeenCalled());
        expect(setInboxItems.mock.lastCall?.[0]).toHaveLength(1);
        expect(notify).not.toHaveBeenCalled();
    });

    it("still announces a DIFFERENT reminder in the same delta", async () => {
        // A push for one reminder must not silence another that happened to
        // come due in the same sync.
        const { notify } = mount();
        serverAdds = [reminderRow(13), reminderRow(14)];

        await resyncAndSettle("todo_reminder:13");

        await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
        expect(notify.mock.calls[0][0].id).toBe("todo_reminder:14");
    });

    it("does not carry a delivered tag into a later, unrelated cycle", async () => {
        // The set is scoped to one coalesced run. A push suppressing the page
        // card is a statement about that arrival, not about the reminder id
        // forever — a second reminder reusing nothing must still announce.
        const { notify } = mount();
        serverAdds = [reminderRow(15)];
        await resyncAndSettle("todo_reminder:15");
        expect(notify).not.toHaveBeenCalled();

        // Same row, new cycle: it's in storage now, so the guard that keeps it
        // quiet must be the before-snapshot, not a leftover delivered tag.
        stored = [];
        serverAdds = [reminderRow(15)];
        await resyncAndSettle();

        await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
        expect(notify.mock.calls[0][0].id).toBe("todo_reminder:15");
    });

    it("relies on the manager to collapse a repeat within the dedupe window", async () => {
        // Belt and braces: even if two cycles both see a row as new (storage
        // cleared between them, say), the shared intent id is what stops a
        // second card. Same mechanism that dedupes against the push.
        const { manager, notify } = mount();
        serverAdds = [reminderRow(16)];
        await resyncAndSettle();
        await waitFor(() => expect(notify).toHaveBeenCalled());

        expect(manager.notify(notify.mock.calls[0][0])).toBe("ignored-duplicate");
    });
});

describe("useInboxResync — overlapping requests", () => {
    it("coalesces a request that arrives mid-sync into one extra pass", async () => {
        // The sweep timer and the push for one reminder land seconds apart, so
        // overlap is the expected case. Dropping the second request outright
        // would be wrong: the in-flight sync may have read the server before
        // the second reminder's row existed.
        let releaseLoad: (() => void) | null = null;
        request.mockImplementation(async (method: string) => {
            if (method === "popInboxItems") return stored;
            if (method === "loadInbox") {
                loadCount += 1;
                if (loadCount === 1) {
                    await new Promise<void>((resolve) => {
                        releaseLoad = resolve;
                    });
                }
                stored = [...stored, ...serverAdds];
                serverAdds = [];
            }
            return undefined;
        });

        mount();
        requestInboxResync("reminder-sweep");
        await waitFor(() => expect(releaseLoad).not.toBeNull());

        // Three more asks while the first is parked mid-flight.
        requestInboxResync("reminder-sweep");
        requestInboxResync("push", "todo_reminder:99");
        requestInboxResync("reminder-sweep");
        releaseLoad!();

        // One follow-up pass total, not one per request.
        await waitFor(() => expect(loadCount).toBe(2));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(loadCount).toBe(2);
    });

    it("ignores a bare event with no detail", async () => {
        // Nothing in the app dispatches one, but the bus is a plain window
        // event and anything on the page can fire its name.
        mount();
        window.dispatchEvent(new Event("inbox:resync"));
        await Promise.resolve();
        expect(loadCount).toBe(0);
    });
});

describe("requestInboxResync — the answer", () => {
    it("resolves with how many rows were new once the sync is done", async () => {
        mount();
        stored = [joinRequestRow(1)];
        serverAdds = [joinRequestRow(2), joinRequestRow(3)];

        // The Sync button's "2 new items". Counted against what storage held
        // BEFORE the sync, like the reminder diff, not against React state.
        expect(await requestInboxResync("manual")).toEqual({ ok: true, added: 2 });
    });

    it("says up to date when nothing was new", async () => {
        mount();
        stored = [joinRequestRow(1)];
        expect(await requestInboxResync("manual")).toEqual({ ok: true, added: 0 });
    });

    it("says it failed when the sync rejects, and the next one still works", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        mount();
        request.mockRejectedValueOnce(new Error("offline"));
        expect(await requestInboxResync("manual")).toEqual({ ok: false, added: 0 });

        serverAdds = [joinRequestRow(4)];
        expect(await requestInboxResync("manual")).toEqual({ ok: true, added: 1 });
    });

    it("says it failed when nothing is listening (signed out) rather than waiting forever", async () => {
        // No hook mounted at all: the promise must still settle.
        expect(await requestInboxResync("manual")).toEqual({ ok: false, added: 0 });

        renderHook(() => useInboxResync(myself, null, null, vi.fn()));
        expect(await requestInboxResync("manual")).toEqual({ ok: false, added: 0 });
        expect(request).not.toHaveBeenCalled();
    });

    it("answers every caller of a coalesced cycle with the same result, from one extra pass", async () => {
        let releaseLoad: (() => void) | null = null;
        request.mockImplementation(async (method: string) => {
            if (method === "popInboxItems") return stored;
            if (method === "loadInbox") {
                loadCount += 1;
                if (loadCount === 1) {
                    await new Promise<void>((resolve) => {
                        releaseLoad = resolve;
                    });
                }
                stored = [...stored, ...serverAdds];
                serverAdds = [];
            }
            return undefined;
        });
        mount();
        serverAdds = [joinRequestRow(5)];

        const first = requestInboxResync("manual");
        await waitFor(() => expect(releaseLoad).not.toBeNull());
        const second = requestInboxResync("schedule-run");
        releaseLoad!();

        // The first pass found row 5; the follow-up found nothing more; both
        // callers hear the whole cycle's total, not just their own pass.
        expect(await Promise.all([first, second])).toEqual([
            { ok: true, added: 1 },
            { ok: true, added: 1 },
        ]);
        expect(loadCount).toBe(2);
    });
});

let clockBase = Date.now();

describe("useInboxResync — the tab or window coming back", () => {
    // Fake Date and timers only: the hook's check waits one task, and the
    // throttle is wall-clock. `shouldAdvanceTime` is off so nothing moves
    // unless the test says so.
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
        // The sync clock is module state that outlives a test, so every test
        // starts an hour after the last one (and after real "now", which is when
        // the module loaded): "long ago" relative to whatever was stamped.
        clockBase += 60 * 60_000;
        vi.setSystemTime(clockBase);
    });
    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
    });

    const comeBack = async (...events: Array<"focus" | "visibilitychange">) => {
        for (const name of events) {
            if (name === "focus") window.dispatchEvent(new Event("focus"));
            else document.dispatchEvent(new Event("visibilitychange"));
        }
        await vi.advanceTimersByTimeAsync(0);
        // The sync itself is a chain of awaited (mocked) requests.
        for (let i = 0; i < 20; i++) await Promise.resolve();
    };

    it("syncs when the last sync is older than a minute", async () => {
        mount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        await comeBack("focus");
        expect(loadCount).toBe(1);
    });

    it("does nothing within a minute of the last sync (Cmd-Tab back and forth is free)", async () => {
        mount();
        markInboxSyncing();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS - 1000);
        await comeBack("focus", "visibilitychange");
        expect(loadCount).toBe(0);
    });

    it("counts its own sync: back-to-back returns cost one request", async () => {
        mount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        await comeBack("focus");
        await comeBack("focus");
        vi.setSystemTime(Date.now() + 30_000);
        await comeBack("visibilitychange");
        expect(loadCount).toBe(1);

        // And a minute later it is allowed again.
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS);
        await comeBack("focus");
        expect(loadCount).toBe(2);
    });

    it("`focus` and `visibilitychange` together are one sync", async () => {
        mount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        await comeBack("focus", "visibilitychange");
        expect(loadCount).toBe(1);
    });

    it("does not repeat a sync the wake refresh just started", async () => {
        // `refreshAllData` stamps the clock synchronously. The check runs one task
        // after the event, so it sees that whichever listener ran first.
        mount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        document.dispatchEvent(new Event("visibilitychange"));
        markInboxSyncing();
        await vi.advanceTimersByTimeAsync(0);
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(loadCount).toBe(0);
    });

    it("stays quiet while the page is hidden", async () => {
        mount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
        });
        await comeBack("visibilitychange");
        expect(loadCount).toBe(0);
    });

    it("stops listening when the hook unmounts", async () => {
        const setInboxItems = vi.fn();
        const view = renderHook(() => useInboxResync(myself, "token-1", null, setInboxItems));
        view.unmount();
        vi.setSystemTime(Date.now() + INBOX_FOCUS_RESYNC_MS + 1);
        await comeBack("focus");
        expect(loadCount).toBe(0);
    });
});
