/**
 * Live thread reply-DELETE replyCount update tests.
 *
 * Symmetric to V3ThreadReplyCountLive: when a thread reply is deleted,
 * Django atomically decrements `parent.reply_count`. The Flask handler
 * needs the `parent_id` in the delete payload to know which parent to
 * fetch + broadcast `message.updated` for. The frontend's
 * `deleteMessage` derives parent_id from the in-memory store and
 * forwards it; the receiving side reuses the same handleMessageUpdated
 * path that the V3ThreadReplyCountLive tests cover.
 *
 * These tests focus on the FE outbound shape: when the deleted message
 * is a thread reply, `parent_id` is forwarded; when it's a top-level
 * message, `parent_id` is null.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
    type Flag,
    type Message,
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

type SocketAck = { ok: true; data?: unknown } | { ok: false; code: string; message: string };

interface SocketStub {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
}

function stubSocket(): SocketStub {
    const emit = vi.fn() as SocketStub["emit"];
    emit.mockImplementation((_event, _payload, ack: (a: SocketAck) => void) => {
        ack({ ok: true });
    });
    const stub: SocketStub = { connected: true, emit };
    (channelService as unknown as { socket: SocketStub }).socket = stub;
    return stub;
}

function detachSocket() {
    (channelService as unknown as { socket: null }).socket = null;
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
        _members: Map<string, unknown>;
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

describe("deleteMessage forwards parent_id for thread replies", () => {
    beforeEach(async () => {
        await resetService();
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

    it("includes parent_id when the message being deleted IS a thread reply", async () => {
        // Seed a thread root + a reply on it.
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-reply", "c-1", {
                isThreadReply: true,
                threadRootId: "m-root",
                parentId: "m-root",
            })
        );

        const sock = stubSocket();
        await channelService.deleteMessage("m-reply", "c-1", ChannelKind.GM);

        const deleteCalls = sock.emit.mock.calls.filter((c) => c[0] === "message.delete");
        expect(deleteCalls).toHaveLength(1);
        const payload = deleteCalls[0][1] as Record<string, unknown>;
        expect(payload.message_id).toBe("m-reply");
        expect(payload.parent_id).toBe("m-root");
    });

    it("passes parent_id as null when the message is a top-level (non-thread) message", async () => {
        channelService.handleMessageCreated(fakeMessage("m-top", "c-1"));
        const sock = stubSocket();
        await channelService.deleteMessage("m-top", "c-1", ChannelKind.GM);

        const payload = sock.emit.mock.calls.find((c) => c[0] === "message.delete")?.[1] as
            | Record<string, unknown>
            | undefined;
        expect(payload?.message_id).toBe("m-top");
        expect(payload?.parent_id).toBeNull();
    });

    it("passes parent_id as null when the message isn't in the store (defensive)", async () => {
        // No prior handleMessageCreated for "m-ghost" — store-side
        // lookup misses. The emit should still go out (the server
        // is the authoritative source of truth on parent linkage),
        // just without the parent_id optimization.
        const sock = stubSocket();
        await channelService.deleteMessage("m-ghost", "c-1", ChannelKind.GM);

        const payload = sock.emit.mock.calls.find((c) => c[0] === "message.delete")?.[1] as
            | Record<string, unknown>
            | undefined;
        expect(payload?.message_id).toBe("m-ghost");
        expect(payload?.parent_id).toBeNull();
    });
});

describe("parent reply_count decrement broadcast (receiving side)", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("a message.updated for the parent decrements the visible chip", () => {
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
        // Seed the parent with replyCount=3.
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 3 }));

        // Simulate the server emitting `message.updated` for the parent
        // after a reply deletion.
        channelService.handleMessageUpdated(
            fakeMessage("m-root", "c-1", {
                replyCount: 2,
                tsUpdated: "2026-01-01T00:01:00Z",
            })
        );

        const root = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-root"
        );
        expect(root?.replyCount).toBe(2);
    });
});
