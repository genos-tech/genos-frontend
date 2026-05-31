/**
 * channel.update / channel.updated tests.
 *
 * Covers:
 *   - `updateChannel(channelId, kind, patch)` outbound emit shape.
 *   - `handleChannelUpdated(channel)` merges metadata in place and
 *     preserves client-side denorms (latestMessage, unreadCount).
 *   - Idempotent / no-op when the channel isn't in the store.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
    type Channel,
    type Flag,
    type Message,
    type PendingMessage,
    type Pin,
    type ReadCursor,
} from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
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
        _cursors: Map<string, ReadCursor>;
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
    svc._cursors.clear();
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
}

describe("updateChannel — outbound emit", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("emits channel.update with snake_case fields", async () => {
        const sock = stubSocket();
        await channelService.updateChannel("c-1", ChannelKind.GM, {
            title: "Renamed",
            profileImageUrl: "https://example.com/avatar.png",
            isPrivate: true,
        });
        const call = sock.emit.mock.calls.find((c) => c[0] === "channel.update");
        expect(call).toBeDefined();
        const payload = call?.[1] as Record<string, unknown>;
        expect(payload).toMatchObject({
            channel_id: "c-1",
            channel_kind: ChannelKind.GM,
            title: "Renamed",
            profile_image_url: "https://example.com/avatar.png",
            is_private: true,
        });
    });

    it("omits unset fields from the payload (defense against null overwrites)", async () => {
        const sock = stubSocket();
        await channelService.updateChannel("c-1", ChannelKind.GM, {
            title: "Just title",
        });
        const payload = sock.emit.mock.calls.find((c) => c[0] === "channel.update")?.[1] as
            | Record<string, unknown>
            | undefined;
        expect(payload).toBeDefined();
        expect(payload).toHaveProperty("title", "Just title");
        expect(payload).not.toHaveProperty("profile_image_url");
        expect(payload).not.toHaveProperty("is_private");
    });
});

describe("handleChannelUpdated — inbound merge", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("updates title/avatar/visibility in place", () => {
        channelService.handleChannelCreated(
            fakeChannel("c-1", {
                title: "Old Name",
                profileImageUrl: "",
                isPrivate: false,
            })
        );
        channelService.handleChannelUpdated(
            fakeChannel("c-1", {
                title: "New Name",
                profileImageUrl: "https://cdn/x.png",
                isPrivate: true,
                tsUpdated: "2026-01-01T12:00:00Z",
            })
        );
        const c = channelService.getSnapshot().channels.get("c-1")!;
        expect(c.title).toBe("New Name");
        expect(c.profileImageUrl).toBe("https://cdn/x.png");
        expect(c.isPrivate).toBe(true);
        expect(c.tsUpdated).toBe("2026-01-01T12:00:00Z");
    });

    it("preserves client-side denorms (latestMessage, unreadCount)", () => {
        // Seed a channel with a denorm that the PATCH response wouldn't
        // include (the PATCH endpoint returns the bare channel row).
        const fakeLatest: Message = {
            id: "m-9",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            sender: {
                userId: "u-a",
                userName: "A",
                userEmail: "a@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
            seq: 9,
            body: [],
            bodyText: "ping",
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
            tsSent: "2026-01-01T00:09:00Z",
            tsUpdated: "2026-01-01T00:09:00Z",
        };
        channelService.handleChannelCreated(
            fakeChannel("c-1", {
                title: "Old",
                latestMessage: fakeLatest,
                unreadCount: 3,
            })
        );

        // The incoming PATCH response carries unreadCount=0 / latestMessage=null
        // (the detail endpoint doesn't populate them). We should NOT overwrite.
        channelService.handleChannelUpdated(
            fakeChannel("c-1", {
                title: "New",
                latestMessage: null,
                unreadCount: 0,
            })
        );

        const c = channelService.getSnapshot().channels.get("c-1")!;
        expect(c.title).toBe("New");
        expect(c.latestMessage?.id).toBe("m-9");
        expect(c.unreadCount).toBe(3);
    });

    it("is a no-op when the channel isn't in the store", () => {
        // Channel never created on this client; an unsolicited
        // channel.updated arrives (e.g. another team's broadcast leaked).
        // Should be silently ignored — no synthesized row.
        channelService.handleChannelUpdated(fakeChannel("c-missing", { title: "Hi" }));
        expect(channelService.getSnapshot().channels.has("c-missing")).toBe(false);
    });

    it("notifies subscribers once on update", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "Old" }));
        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();
        channelService.handleChannelUpdated(fakeChannel("c-1", { title: "New" }));
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });
});
