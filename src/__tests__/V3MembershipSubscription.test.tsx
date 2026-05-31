/**
 * Channel-membership subscription side-effect tests.
 *
 * Closes the "ghost events" reliability gap: when the current user is
 * added/removed from a channel mid-session, the FE needs to join/leave
 * the channel's socket room to match the server's authoritative
 * membership. Otherwise a removed user keeps receiving message events
 * for a channel they no longer see (server-side `emit(..., to=channel)`
 * doesn't know which sockets in the room are still members).
 *
 * Contract:
 *   - `handleChannelMemberAdded` with member.userId === currentUserId:
 *     emits `channel.subscribe` (idempotent — backend handles already-
 *     joined rooms gracefully). For OTHER users being added, no emit.
 *   - `handleChannelMemberRemoved` with userId === currentUserId:
 *     emits `channel.unsubscribe`, then drops channel state.
 *     For OTHER users being removed, no emit; channel state preserved.
 *   - When socket is disconnected, BOTH paths skip the emit (no
 *     synchronous crash; ghost-event handling falls to next reconnect).
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

type SocketAck = { ok: true; data?: unknown } | { ok: false; code: string; message: string };

interface SocketStub {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
}

function stubSocket(connected = true): SocketStub {
    const emit = vi.fn() as SocketStub["emit"];
    emit.mockImplementation((_event, _payload, ack: (a: SocketAck) => void) => {
        ack({ ok: true });
    });
    const stub: SocketStub = { connected, emit };
    (channelService as unknown as { socket: SocketStub }).socket = stub;
    return stub;
}

function detachSocket() {
    (channelService as unknown as { socket: null }).socket = null;
}

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
    for (const channelId of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId,
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
    // Members aren't tied to channels — the self-add tests exercise
    // `handleChannelMemberAdded` without an enclosing channel, so the
    // `_members` map accrues entries that need explicit clearing.
    svc._members.clear();
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
}

describe("handleChannelMemberAdded — self-subscribe", () => {
    beforeEach(async () => {
        await resetService();
        channelService.setCurrentUserId("u-me");
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("emits channel.subscribe when the added member is the current user", () => {
        const sock = stubSocket();
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-1", "u-me"),
        });
        const subscribeCalls = sock.emit.mock.calls.filter((c) => c[0] === "channel.subscribe");
        expect(subscribeCalls).toHaveLength(1);
        expect(subscribeCalls[0][1]).toMatchObject({ channel_id: "c-1" });
    });

    it("does NOT emit channel.subscribe when a DIFFERENT user is added", () => {
        const sock = stubSocket();
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-1", "u-alice"),
        });
        const subscribeCalls = sock.emit.mock.calls.filter((c) => c[0] === "channel.subscribe");
        expect(subscribeCalls).toHaveLength(0);
    });

    it("does NOT emit when the socket is disconnected (avoids sync throw)", () => {
        detachSocket();
        // Should not throw — just no subscribe attempt.
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-1", "u-me"),
        });
        // Member still added to the roster.
        const snap = channelService.getSnapshot();
        const members = snap.membersByChannel.get("c-1") ?? [];
        expect(members).toHaveLength(1);
    });

    it("adds the member to the channel roster regardless of self vs other", () => {
        stubSocket();
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-1", "u-alice"),
        });
        channelService.handleChannelMemberAdded({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            member: fakeMember("mem-2", "u-me"),
        });
        const members = channelService.getSnapshot().membersByChannel.get("c-1") ?? [];
        expect(members.map((m) => m.userId).sort()).toEqual(["u-alice", "u-me"]);
    });
});

describe("handleChannelMemberRemoved — self-unsubscribe", () => {
    beforeEach(async () => {
        await resetService();
        channelService.setCurrentUserId("u-me");
        // Seed a channel the test will exercise removal from.
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
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("emits channel.unsubscribe when the current user is removed", () => {
        const sock = stubSocket();
        // Reset the emit history so we only see the post-setup calls
        // (handleChannelCreated above would have already fired
        // channel.subscribe via the auto-subscribe path).
        sock.emit.mockClear();

        channelService.handleChannelMemberRemoved({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            userId: "u-me",
        });
        const unsubCalls = sock.emit.mock.calls.filter((c) => c[0] === "channel.unsubscribe");
        expect(unsubCalls).toHaveLength(1);
        expect(unsubCalls[0][1]).toMatchObject({
            channel_id: "c-1",
            kind: ChannelKind.GM,
        });
    });

    it("drops the channel from the store on self-removal", () => {
        stubSocket();
        expect(channelService.getSnapshot().channels.has("c-1")).toBe(true);
        channelService.handleChannelMemberRemoved({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            userId: "u-me",
        });
        expect(channelService.getSnapshot().channels.has("c-1")).toBe(false);
    });

    it("does NOT emit unsubscribe when a DIFFERENT user is removed", () => {
        const sock = stubSocket();
        sock.emit.mockClear();
        channelService.handleChannelMemberRemoved({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            userId: "u-alice",
        });
        const unsubCalls = sock.emit.mock.calls.filter((c) => c[0] === "channel.unsubscribe");
        expect(unsubCalls).toHaveLength(0);
        // Channel still in the store for the still-member viewer.
        expect(channelService.getSnapshot().channels.has("c-1")).toBe(true);
    });

    it("does NOT emit when the socket is disconnected (store still cleared)", () => {
        detachSocket();
        channelService.handleChannelMemberRemoved({
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            userId: "u-me",
        });
        // Channel is still cleared from the store — the unsubscribe is
        // just deferred to whenever the socket reconnects (at which
        // point the user wouldn't be in the room anyway because the
        // connect handler only re-joins channels they're a member of
        // per the server's authoritative list).
        expect(channelService.getSnapshot().channels.has("c-1")).toBe(false);
    });
});
