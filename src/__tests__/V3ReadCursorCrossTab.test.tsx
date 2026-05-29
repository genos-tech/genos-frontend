/**
 * Cross-tab read-cursor decrement tests.
 *
 * Backend wires up: `read.advance` from Tab A → broadcast `read.advanced`
 * to the user's own room → Tab B receives and runs
 * `handleReadAdvanced`. This file verifies the FE-side semantics on
 * the receiving end.
 *
 * Key correctness invariant tested: `unreadCount` is recomputed from
 * the cursor + known messages, NOT unconditionally reset to 0. The
 * "reset to 0" approach (previous behavior) loses information when a
 * NEW message arrived between Tab A's emit and Tab B's receive —
 * Tab B would zero out unread even though the new message is still
 * unread.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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

function fakeMessage(
    id: string,
    channelId: string,
    seq: number,
    overrides: Partial<Message> = {}
): Message {
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
        seq,
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
        tsSent: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
        tsUpdated: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
        ...overrides,
    };
}

function fakeCursor(
    channelId: string,
    lastReadMessageId: string | null,
    overrides: Partial<ReadCursor> = {}
): ReadCursor {
    return {
        id: `rc-${channelId}`,
        channelId,
        threadRootId: null,
        lastReadMessageId,
        lastReadAt: "2026-01-01T00:00:01Z",
        ...overrides,
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

describe("handleReadAdvanced — cross-tab unread decrement", () => {
    beforeEach(async () => {
        await resetService();
        channelService.handleChannelCreated(fakeChannel("c-1", { unreadCount: 5 }));
        // Seed 5 messages, seq 1-5.
        for (let i = 1; i <= 5; i++) {
            channelService.handleMessageCreated(fakeMessage(`m-${i}`, "c-1", i));
        }
    });

    it("Tab B receives Tab A's cursor advance to the latest msg → unreadCount = 0", () => {
        // Pre-condition: Tab B sees 5 unread.
        // NOTE: the seed `handleMessageCreated` calls above bumped
        // unread for messages with sender != currentUserId (Alice vs
        // null in tests), so the actual unread count after seeding
        // depends on the `_bumpUnread` path. We force-set it here to
        // mirror the production state we want to verify.
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        channelService.handleReadAdvanced(fakeCursor("c-1", "m-5"));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(0);
        expect(channelService.getSnapshot().cursorsByChannel.get("c-1")?.lastReadMessageId).toBe(
            "m-5"
        );
    });

    it("Tab B receives a cursor advance to a MIDDLE msg → unreadCount = count above", () => {
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        // Tab A read up to seq 3 (m-3). Messages 4 and 5 are still
        // unread → unreadCount=2.
        channelService.handleReadAdvanced(fakeCursor("c-1", "m-3"));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(2);
    });

    it("RACE: new message arrived after Tab A's emit → unread stays correct", () => {
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        // Order of events on Tab B:
        //   1. message.created for m-6 (seq 6) → unreadCount bumps to 6.
        //   2. read.advanced lands with cursor = m-5 (sent BEFORE m-6
        //      was created on the server).
        //
        // The OLD behavior reset to 0, losing m-6. The NEW behavior
        // recomputes from the cursor: m-6.seq > m-5.seq → 1 unread.
        channelService.handleMessageCreated(fakeMessage("m-6", "c-1", 6));
        // After the message.created, unread bumped from 5 → 6 (assuming
        // a peer-sent message).
        channelService.handleReadAdvanced(fakeCursor("c-1", "m-5"));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(1);
    });

    it("cursor points at a message we haven't loaded → falls back to 0", () => {
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        // Cursor references "m-99" which we don't have. Fall back to 0
        // (the next chat-list refresh will correct with the server's
        // authoritative count).
        channelService.handleReadAdvanced(fakeCursor("c-1", "m-99"));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(0);
    });

    it("cursor.lastReadMessageId is null → unread = count of all top-level", () => {
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        // Defensive: a fresh-account / never-read state. The cursor
        // arrives with lastReadMessageId=null. unread should equal
        // every known top-level message (5 in this fixture).
        channelService.handleReadAdvanced(fakeCursor("c-1", null));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(5);
    });

    it("does NOT touch unreadCount when the cursor is for a thread (not main timeline)", () => {
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        // Thread cursors are scoped per-thread; the main-pane unread
        // badge should be untouched by an advance in some thread.
        channelService.handleReadAdvanced(fakeCursor("c-1", "m-3", { threadRootId: "m-root" }));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        expect(updated.unreadCount).toBe(5);
    });

    it("thread-reply messages don't count toward the main timeline unread", () => {
        // Add a thread reply (seq=10 but isThreadReply=true). The
        // main-timeline unread count should ignore it.
        channelService.handleMessageCreated(
            fakeMessage("m-reply", "c-1", 10, {
                isThreadReply: true,
                threadRootId: "m-1",
                parentId: "m-1",
            })
        );
        const ch = channelService.getSnapshot().channels.get("c-1")!;
        channelService.handleChannelCreated({ ...ch, unreadCount: 5 });

        channelService.handleReadAdvanced(fakeCursor("c-1", "m-3"));

        const updated = channelService.getSnapshot().channels.get("c-1")!;
        // m-4 (seq 4) and m-5 (seq 5) are unread; m-reply (thread)
        // does NOT count. → 2 unread.
        expect(updated.unreadCount).toBe(2);
    });
});
