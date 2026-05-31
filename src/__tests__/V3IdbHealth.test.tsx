/**
 * IDB cache health tracking tests.
 *
 * Verifies that `_persist*` failures (which are normally swallowed
 * fire-and-forget) flow into the `idbHealth` field on the snapshot
 * so a dev panel can render "cache degraded" + an Acknowledge button.
 *
 * Contract:
 *   - Initial state: status="ok", lastError=null, errorCount=0.
 *   - Any IDB throw → status="degraded", lastError={source, message, at},
 *     errorCount incremented.
 *   - Successful IDB ops do NOT auto-clear the degraded state — a
 *     burst of failures followed by one success isn't "healthy."
 *   - `resetIdbHealth()` clears state and bumps snapshot version so
 *     subscribers re-render.
 *   - Snapshot version increments on each state change so React's
 *     `useSyncExternalStore` re-fires.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message } from "../types/channel";

// IDB stub that REJECTS — this is what triggers `_persist*` to enter
// the catch block and record an error. The mock is per-test so we
// can replace it with a resolving version when needed.
const initDBMock = vi.fn();
vi.mock("../db/config/schema", () => ({
    initDB: () => initDBMock(),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function fakeMessage(id: string, channelId: string, overrides: Partial<Message> = {}): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: "u-alice",
            userName: "Alice",
            userEmail: "alice@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: id,
        parentId: null,
        threadRootId: null,
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
        ...overrides,
    };
}

async function resetService() {
    // Reset to "ok" first so the count from a prior test doesn't bleed.
    channelService.resetIdbHealth();
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    // Reset health AGAIN — the unmember handler runs `_persistChannelDelete`
    // which itself bumps the counter.
    channelService.resetIdbHealth();
}

describe("idbHealth", () => {
    beforeEach(async () => {
        // Default: IDB rejects. Tests that need a resolving IDB call
        // `initDBMock.mockResolvedValueOnce(...)` to override.
        initDBMock.mockReset();
        initDBMock.mockRejectedValue(new Error("IDB unavailable in tests"));
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts in ok state with zero errors", () => {
        const snap = channelService.getSnapshot();
        expect(snap.idbHealth.status).toBe("ok");
        expect(snap.idbHealth.lastError).toBeNull();
        expect(snap.idbHealth.errorCount).toBe(0);
    });

    it("flips to degraded after the first IDB failure", async () => {
        // handleMessageCreated kicks off `_persistMessage` async.
        // The IDB mock rejects, so the catch block fires and records.
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        // _persistMessage is fire-and-forget; flush microtasks until
        // the catch lands.
        await vi.waitFor(() => {
            const snap = channelService.getSnapshot();
            expect(snap.idbHealth.status).toBe("degraded");
        });
        const snap = channelService.getSnapshot();
        expect(snap.idbHealth.errorCount).toBeGreaterThanOrEqual(1);
        expect(snap.idbHealth.lastError?.source).toBe("_persistMessage");
        expect(snap.idbHealth.lastError?.message).toContain("IDB unavailable");
    });

    it("each failure increments errorCount and updates lastError.at", async () => {
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.errorCount).toBe(1);
        });
        const firstAt = channelService.getSnapshot().idbHealth.lastError?.at;

        // Wait a tick so the at-timestamps differ.
        await new Promise((r) => setTimeout(r, 5));
        channelService.handleMessageCreated(fakeMessage("m-2", "c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.errorCount).toBe(2);
        });
        const secondAt = channelService.getSnapshot().idbHealth.lastError?.at;
        expect(secondAt).not.toBe(firstAt);
    });

    it("subscribers fire on each error transition", async () => {
        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();

        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        // The synchronous handleMessageCreated already notified — wait
        // for the additional notify from the IDB catch.
        const initialCalls = listener.mock.calls.length;
        await vi.waitFor(() => {
            expect(listener.mock.calls.length).toBeGreaterThan(initialCalls);
        });
        unsubscribe();
    });

    it("does NOT auto-clear on a successful IDB op after a failure", async () => {
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.status).toBe("degraded");
        });

        // Swap the mock to a no-throw `db.put` shim. The status should
        // STAY degraded — that's the whole point.
        const dbStub = {
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue(undefined),
        };
        initDBMock.mockResolvedValue(dbStub);
        channelService.handleMessageCreated(fakeMessage("m-2", "c-1"));
        // Yield microtasks to let _persistMessage complete.
        await new Promise((r) => setTimeout(r, 10));
        expect(channelService.getSnapshot().idbHealth.status).toBe("degraded");
    });

    it("resetIdbHealth() clears state back to ok", async () => {
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.status).toBe("degraded");
        });
        channelService.resetIdbHealth();
        const snap = channelService.getSnapshot();
        expect(snap.idbHealth.status).toBe("ok");
        expect(snap.idbHealth.errorCount).toBe(0);
        expect(snap.idbHealth.lastError).toBeNull();
    });

    it("resetIdbHealth() is a no-op when state is already ok (no notify)", () => {
        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();
        channelService.resetIdbHealth();
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it("records source distinctly per persist method", async () => {
        // `handleChannelCreated` writes only via `_persistChannel`.
        channelService.handleChannelCreated(fakeChannel("c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.lastError?.source).toBe(
                "_persistChannel"
            );
        });

        // `handleReadAdvanced` writes only via `_persistCursor`.
        // (Distinct from `handleMessageCreated`, which fans out to both
        // `_persistMessage` and `_persistChannelLatest` → racy source.)
        channelService.handleReadAdvanced({
            id: "rc-1",
            channelId: "c-1",
            threadRootId: null,
            lastReadMessageId: "m-x",
            lastReadAt: "2026-01-01T00:00:01Z",
        });
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.lastError?.source).toBe(
                "_persistCursor"
            );
        });
    });

    it("snapshot version bumps on each idbHealth change", async () => {
        const v0 = channelService.getSnapshot().version;
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        await vi.waitFor(() => {
            expect(channelService.getSnapshot().idbHealth.status).toBe("degraded");
        });
        const v1 = channelService.getSnapshot().version;
        expect(v1).toBeGreaterThan(v0);

        channelService.resetIdbHealth();
        const v2 = channelService.getSnapshot().version;
        expect(v2).toBeGreaterThan(v1);
    });
});
