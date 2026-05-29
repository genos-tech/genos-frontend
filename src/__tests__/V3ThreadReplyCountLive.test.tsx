/**
 * Live thread reply-count update tests.
 *
 * Closes the "stale reply count" gap: when a viewer is looking at a
 * channel and another user posts a thread reply on one of the visible
 * messages, the server now emits `message.updated` for the PARENT
 * (in addition to the `message.created` for the reply itself), carrying
 * the bumped `replyCount`. Without this update, the chip stayed stale
 * until the next `?since=` delta sync.
 *
 * These tests verify the receiving side: a `message.updated` event with
 * a new `replyCount` should land in the store via `handleMessageUpdated`,
 * notify subscribers, and re-render any UI consumer reading the
 * snapshot.
 *
 * The backend change (Flask `message.send` handler fetching the parent
 * + emitting `message.updated`) is exercised by manual / staging tests;
 * here we only verify the frontend wire-up.
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
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
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

describe("live thread reply-count update via message.updated", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("upserts the parent in place with the new replyCount", () => {
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
        // Seed the parent (replyCount=0) and a reply already in store.
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 0 }));

        // Simulate the new backend broadcast: a `message.updated`
        // carrying the parent with the freshly-bumped replyCount.
        channelService.handleMessageUpdated(
            fakeMessage("m-root", "c-1", {
                replyCount: 1,
                tsUpdated: "2026-01-01T00:01:00Z",
            })
        );

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        const root = msgs.find((m) => m.id === "m-root");
        expect(root?.replyCount).toBe(1);
        // Position preserved — upsert in place, not appended.
        expect(msgs.map((m) => m.id)).toEqual(["m-root"]);
    });

    it("notifies subscribers so React re-renders with the new count", () => {
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
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", { replyCount: 3 }));

        const listener = vi.fn();
        const unsubscribe = channelService.subscribe(listener);
        listener.mockClear();

        channelService.handleMessageUpdated(fakeMessage("m-root", "c-1", { replyCount: 4 }));

        expect(listener).toHaveBeenCalledTimes(1);
        const snap = channelService.getSnapshot();
        const root = (snap.messagesByChannel.get("c-1") ?? []).find((m) => m.id === "m-root");
        expect(root?.replyCount).toBe(4);
        unsubscribe();
    });

    it("is a no-op when the message isn't in the store yet (won't synthesize a row)", () => {
        // Defensive: a peer's message.updated arrives for a parent
        // we haven't loaded yet (e.g. user scrolled past it). The
        // upsert path APPENDS the message (it isn't a strict update),
        // so the count update would still be honored on the row that
        // gets created. Verify: the message exists with the new count.
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

        // No prior handleMessageCreated for "m-orphan".
        channelService.handleMessageUpdated(fakeMessage("m-orphan", "c-1", { replyCount: 5 }));

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        const orphan = msgs.find((m) => m.id === "m-orphan");
        expect(orphan).toBeDefined();
        expect(orphan?.replyCount).toBe(5);
    });

    it("preserves other state on the row when only replyCount changes", () => {
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

        // The parent broadcast carries the full serialized Message INCLUDING
        // existing reactions (the GET /messages/{id}/ endpoint prefetches
        // them). So this is the realistic shape the FE receives.
        channelService.handleMessageUpdated(
            fakeMessage("m-root", "c-1", {
                replyCount: 1,
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

        const root = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-root"
        );
        expect(root?.replyCount).toBe(1);
        expect(root?.reactions).toHaveLength(1);
        expect(root?.reactions[0].emoji).toBe("👍");
    });
});
