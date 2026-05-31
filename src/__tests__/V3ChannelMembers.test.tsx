/**
 * Channel-member roster cold-fetch tests.
 *
 * Closes the "empty members list on cold channel open" gap: before
 * this, `_members[channelId]` only populated from live
 * `channel.member_added` events. A user opening a channel they
 * haven't touched this session would see an empty roster.
 *
 * Contract:
 *   - `fetchChannelMembers(channelId)` GETs `/api/v3/channels/{id}/members/`.
 *   - `handleChannelMembersReplaced(channelId, members)` does a
 *     union-replace: server snapshot wins for IDs in the snapshot;
 *     any pre-existing live-event entries NOT in the snapshot are
 *     preserved (so a race between fetch and a `channel.member_added`
 *     socket event doesn't drop the live add).
 *   - `syncChannel` triggers the fetch only on FIRST sync of the
 *     session (when `_members` for the channel is empty). Subsequent
 *     syncs skip the roster call.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
    type ChannelMember,
    type Flag,
    type PendingMessage,
    type Pin,
} from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function fakeMember(id: string, userId: string): ChannelMember {
    return {
        id,
        userId,
        role: "member",
        tsJoined: "2026-01-01T00:00:00Z",
    };
}

async function resetService() {
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    const svc = channelService as unknown as {
        _inflightSyncByChannel: Map<string, Promise<void>>;
        _pendingByCorrelationId: Map<string, PendingMessage>;
        _pendingByChannel: Map<string, PendingMessage[]>;
        _pendingResolvers: Map<string, { resolve: unknown; reject: (e: Error) => void }>;
        _pins: Map<string, Pin>;
        _flags: Map<string, Flag>;
        _pinByChannelId: Map<string, Pin>;
        _flagByMessageId: Map<string, Flag>;
        _members: Map<string, ChannelMember[]>;
    };
    for (const r of svc._pendingResolvers.values()) {
        r.reject(new Error("test cleanup"));
    }
    svc._pendingByCorrelationId.clear();
    svc._pendingByChannel.clear();
    svc._pendingResolvers.clear();
    svc._inflightSyncByChannel.clear();
    svc._pins.clear();
    svc._flags.clear();
    svc._pinByChannelId.clear();
    svc._flagByMessageId.clear();
    svc._members.clear();
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
}

function stubCheckpoints() {
    const store = new Map<string, string>();
    const stub = {
        getCheckpoint: vi.fn(async (k: string) => store.get(k) ?? null),
        setCheckpoint: vi.fn(async (k: string, v: string) => {
            store.set(k, v);
        }),
    };
    (channelService as unknown as { _checkpointRepo: typeof stub })._checkpointRepo = stub;
    return stub;
}

describe("handleChannelMembersReplaced — union semantics", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("replaces the roster with the server snapshot", () => {
        channelService.handleChannelMembersReplaced("c-1", [
            fakeMember("mem-1", "u-alice"),
            fakeMember("mem-2", "u-bob"),
        ]);
        const members = channelService.getSnapshot().membersByChannel.get("c-1") ?? [];
        expect(members.map((m) => m.userId).sort()).toEqual(["u-alice", "u-bob"]);
    });

    it("preserves a live-event entry that arrived during the fetch (race)", () => {
        // Simulate: a `channel.member_added` event lands while the
        // `fetchChannelMembers` is in flight. The snapshot is older
        // than the live add. The union should preserve the live entry.
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-late", "u-carol"),
        });
        // Server snapshot (without Carol — it captured before her join).
        channelService.handleChannelMembersReplaced("c-1", [
            fakeMember("mem-1", "u-alice"),
            fakeMember("mem-2", "u-bob"),
        ]);
        const members = channelService.getSnapshot().membersByChannel.get("c-1") ?? [];
        expect(members.map((m) => m.userId).sort()).toEqual(["u-alice", "u-bob", "u-carol"]);
    });

    it("server entry replaces a stale live-event entry on the same id", () => {
        // Live event arrives first with a role of "member".
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: { ...fakeMember("mem-1", "u-alice"), role: "member" },
        });
        // Snapshot has Alice with a different role (someone promoted her
        // between the live event and the snapshot capture).
        channelService.handleChannelMembersReplaced("c-1", [
            { ...fakeMember("mem-1", "u-alice"), role: "admin" },
        ]);
        const alice = (channelService.getSnapshot().membersByChannel.get("c-1") ?? []).find(
            (m) => m.id === "mem-1"
        );
        expect(alice?.role).toBe("admin");
    });

    it("notifies subscribers exactly once for the replace operation", () => {
        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();
        channelService.handleChannelMembersReplaced("c-1", [fakeMember("mem-1", "u-alice")]);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });
});

describe("syncChannel triggers member fetch only on first sync", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls fetchChannelMembers when _members is empty (first open)", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated({
            id: "c-1",
            kind: ChannelKind.GM,
            title: "Engineering",
            profileImageUrl: "",
            projectId: null,
            ownerId: null,
            isPrivate: false,
            latestMessage: null,
            unreadCount: 0,
            tsCreated: "2026-01-01T00:00:00Z",
            tsUpdated: "2026-01-01T00:00:00Z",
        });
        const msgsSpy = vi.spyOn(channelService, "fetchMessagesDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:00Z",
            data: { messages: [], deletes: [] },
        });
        const threadsSpy = vi.spyOn(channelService, "fetchThreadsDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:01Z",
            data: { messages: [], deletes: [] },
        });
        const membersSpy = vi
            .spyOn(channelService, "fetchChannelMembers")
            .mockResolvedValue([fakeMember("mem-1", "u-alice")]);

        await channelService.syncChannel("c-1");

        expect(membersSpy).toHaveBeenCalledTimes(1);
        expect(membersSpy).toHaveBeenCalledWith("c-1");
        const members = channelService.getSnapshot().membersByChannel.get("c-1") ?? [];
        expect(members.map((m) => m.id)).toEqual(["mem-1"]);

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
        membersSpy.mockRestore();
    });

    it("does NOT call fetchChannelMembers when roster is already populated", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated({
            id: "c-1",
            kind: ChannelKind.GM,
            title: "Engineering",
            profileImageUrl: "",
            projectId: null,
            ownerId: null,
            isPrivate: false,
            latestMessage: null,
            unreadCount: 0,
            tsCreated: "2026-01-01T00:00:00Z",
            tsUpdated: "2026-01-01T00:00:00Z",
        });
        // Seed an existing roster (e.g. from a prior sync this session).
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-1", "u-alice"),
        });

        const msgsSpy = vi.spyOn(channelService, "fetchMessagesDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:00Z",
            data: { messages: [], deletes: [] },
        });
        const threadsSpy = vi.spyOn(channelService, "fetchThreadsDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:01Z",
            data: { messages: [], deletes: [] },
        });
        const membersSpy = vi.spyOn(channelService, "fetchChannelMembers");

        await channelService.syncChannel("c-1");
        expect(membersSpy).not.toHaveBeenCalled();

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
        membersSpy.mockRestore();
    });

    it("member-fetch failure is non-fatal — messages still load", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated({
            id: "c-1",
            kind: ChannelKind.GM,
            title: "Engineering",
            profileImageUrl: "",
            projectId: null,
            ownerId: null,
            isPrivate: false,
            latestMessage: null,
            unreadCount: 0,
            tsCreated: "2026-01-01T00:00:00Z",
            tsUpdated: "2026-01-01T00:00:00Z",
        });
        const msgsSpy = vi.spyOn(channelService, "fetchMessagesDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:00Z",
            data: { messages: [], deletes: [] },
        });
        const threadsSpy = vi.spyOn(channelService, "fetchThreadsDelta").mockResolvedValue({
            server_time: "2026-05-29T10:00:01Z",
            data: { messages: [], deletes: [] },
        });
        const membersSpy = vi
            .spyOn(channelService, "fetchChannelMembers")
            .mockRejectedValue(new Error("network"));

        // Should resolve cleanly despite the member fetch failure.
        await expect(channelService.syncChannel("c-1")).resolves.toBeUndefined();
        // Members map untouched (empty).
        const members = channelService.getSnapshot().membersByChannel.get("c-1") ?? [];
        expect(members).toHaveLength(0);

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
        membersSpy.mockRestore();
    });
});
