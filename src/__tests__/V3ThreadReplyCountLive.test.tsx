/**
 * Live thread reply-count update tests.
 *
 * Closes the "stale reply count" gap: when a viewer is looking at a
 * channel and another user posts a thread reply on one of the visible
 * messages, the server emits a NARROW `message.reply_count_changed`
 * delta for the PARENT (in addition to the `message.created` for the
 * reply itself), carrying only the bumped `replyCount`. Without it the
 * chip stayed stale until the next `?since=` delta sync.
 *
 * It is deliberately NOT a full `message.updated` re-broadcast of the
 * parent: that carried the parent's (possibly stale) body and, applied
 * via the whole-object upsert, clobbered a concurrent edit to that
 * parent (BUG #30). These tests verify the receiving side merges only
 * `replyCount` via `handleReplyCountChanged`, no-ops on an unloaded
 * parent, and never overwrites a concurrently-edited body.
 *
 * The backend change (Flask `message.send` / `message.delete` handlers
 * emitting `message.reply_count_changed`) is exercised by the Flask
 * socket tests; here we only verify the frontend wire-up.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
        taskId: null,
        displayId: null,
        taskStatus: null,
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
        ...overrides,
    };
}

function seedChannel(id: string) {
    channelService.handleChannelCreated({
        id,
        kind: ChannelKind.GM,
        title: "Engineering",
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        legacyChatId: null,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
    });
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
    channelService.resetIdbHealth();
}

describe("live thread reply-count update via message.reply_count_changed", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("merges the new replyCount onto the parent in place", () => {
        seedChannel("c-1");
        // Seed the parent (replyCount=0).
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 0 }));

        // The new backend broadcast: a NARROW reply-count delta (no body).
        channelService.handleReplyCountChanged({
            id: "m-root",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            replyCount: 1,
        });

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        const root = msgs.find((m) => m.id === "m-root");
        expect(root?.replyCount).toBe(1);
        // Position preserved — merged in place, not appended.
        expect(msgs.map((m) => m.id)).toEqual(["m-root"]);
    });

    it("notifies subscribers so React re-renders with the new count", () => {
        seedChannel("c-1");
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 3 }));

        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();

        channelService.handleReplyCountChanged({
            id: "m-root",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            replyCount: 4,
        });

        expect(listener).toHaveBeenCalledTimes(1);
        const snap = channelService.getSnapshot();
        const root = (snap.messagesByChannel.get("c-1") ?? []).find((m) => m.id === "m-root");
        expect(root?.replyCount).toBe(4);
        unsubscribe();
    });

    it("is a no-op when the parent isn't in the store yet (won't synthesize a body-less row)", () => {
        // A reply-count delta arrives for a parent the viewer hasn't
        // loaded (scrolled past / not synced). The narrow event merges by
        // id and must NOT synthesize a placeholder row — the count is
        // reconciled on the parent's next delta sync. (The OLD full-row
        // `message.updated` upsert DID synthesize a body-less row, which
        // is part of what made the stale-body clobber possible.)
        seedChannel("c-1");

        // No prior handleMessageCreated for "m-orphan".
        channelService.handleReplyCountChanged({
            id: "m-orphan",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            replyCount: 5,
        });

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-orphan")).toBeUndefined();
    });

    it("preserves other row state (reactions) when only replyCount changes", () => {
        seedChannel("c-1");
        channelService.handleMessageCreated(
            fakeMessage("m-root", "c-1", {
                replyCount: 0,
                reactions: [
                    {
                        id: "r-1",
                        emoji: "👍",
                        tsSent: "2026-01-01T00:00:30Z",
                        user: {
                            userId: "u-bob",
                            userName: "Bob",
                            userEmail: "bob@x",
                            avatarImgPath: null,
                            isSystemUser: false,
                        },
                    },
                ],
            })
        );

        channelService.handleReplyCountChanged({
            id: "m-root",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            replyCount: 1,
        });

        const root = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-root"
        );
        expect(root?.replyCount).toBe(1);
        expect(root?.reactions).toHaveLength(1);
        expect(root?.reactions[0].emoji).toBe("👍");
    });

    // Regression for BUG #30: a thread reply used to re-broadcast the
    // parent's FULL row as `message.updated`, whose (stale) body clobbered
    // a concurrent edit via the whole-object upsert. The narrow
    // reply-count delta must never touch the body.
    it("does not clobber a concurrently-edited body when a reply bumps the count", () => {
        seedChannel("c-1");
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 0 }));

        // A peer's genuine edit lands via the edit path (full message.updated).
        channelService.handleMessageUpdated(
            fakeMessage("m-root", "c-1", {
                bodyText: "EDITED",
                editedAt: "2026-01-01T00:02:00Z",
                tsUpdated: "2026-01-01T00:02:00Z",
            })
        );

        // A concurrent reply bumps the count via the NARROW event (no body).
        channelService.handleReplyCountChanged({
            id: "m-root",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
            replyCount: 1,
        });

        const root = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-root"
        );
        expect(root?.replyCount).toBe(1);
        expect(root?.bodyText).toBe("EDITED"); // body survives — NOT clobbered
    });
});
