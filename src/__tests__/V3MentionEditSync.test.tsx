/**
 * Mention sync on message edit tests.
 *
 * The backend's PATCH handler now re-syncs MessageMention rows when a
 * body is edited: existing rows are wiped, and rows for the new body's
 * mentions are bulk-created. The serialized response (and the
 * `message.updated` broadcast that wraps it) carries the fresh
 * `mentions[]` array.
 *
 * These tests verify the receiving side: when `handleMessageUpdated`
 * lands with a different `mentions[]` than what was previously stored,
 * the upsert correctly replaces the array — which means `@you`
 * indicator visibility flips live.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
    type Flag,
    type Message,
    type MessageMention,
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

function fakeMention(id: string, mentionedUserId: string): MessageMention {
    return {
        id,
        mentionedUserId,
        viaGroupId: null,
        tsCreated: "2026-01-01T00:00:00Z",
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

describe("mention sync on message.updated", () => {
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

    it("an edit that ADDS a mention surfaces the new mention in the store", () => {
        // Original message had no mentions.
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", { mentions: [] }));

        // Sender edits the body to add @Alice — backend wipes & recreates
        // mentions, broadcasts message.updated with new mentions[].
        channelService.handleMessageUpdated(
            fakeMessage("m-1", "c-1", {
                mentions: [fakeMention("mn-1", "u-alice")],
                editedAt: "2026-01-01T00:01:00Z",
            })
        );

        const stored = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-1"
        );
        expect(stored?.mentions).toHaveLength(1);
        expect(stored?.mentions[0].mentionedUserId).toBe("u-alice");
    });

    it("an edit that REMOVES a mention clears it from the store", () => {
        // Original message had @Alice mentioned.
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                mentions: [fakeMention("mn-1", "u-alice")],
            })
        );

        // Sender edits the body to remove @Alice — backend deletes the
        // MessageMention row, broadcast carries an empty mentions[].
        channelService.handleMessageUpdated(
            fakeMessage("m-1", "c-1", {
                mentions: [],
                editedAt: "2026-01-01T00:01:00Z",
            })
        );

        const stored = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-1"
        );
        expect(stored?.mentions).toEqual([]);
    });

    it("an edit that REPLACES one mention with another swaps the user", () => {
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                mentions: [fakeMention("mn-1", "u-alice")],
            })
        );

        // User edits @Alice → @Bob.
        channelService.handleMessageUpdated(
            fakeMessage("m-1", "c-1", {
                mentions: [fakeMention("mn-2", "u-bob")],
                editedAt: "2026-01-01T00:01:00Z",
            })
        );

        const stored = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
            (m) => m.id === "m-1"
        );
        expect(stored?.mentions.map((m) => m.mentionedUserId)).toEqual(["u-bob"]);
    });

    it("an edit that ADDS a mention of the current viewer makes mentionsMe return true", () => {
        localStorage.setItem("userId", "u-me");
        try {
            channelService.handleMessageCreated(fakeMessage("m-1", "c-1", { mentions: [] }));
            // Pre-edit: not mentioned.
            const before = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
                (m) => m.id === "m-1"
            );
            expect(before?.mentions.some((mn) => mn.mentionedUserId === "u-me")).toBe(false);

            // Sender edits to add @me.
            channelService.handleMessageUpdated(
                fakeMessage("m-1", "c-1", {
                    mentions: [fakeMention("mn-1", "u-me")],
                    editedAt: "2026-01-01T00:01:00Z",
                })
            );

            const after = (channelService.getSnapshot().messagesByChannel.get("c-1") ?? []).find(
                (m) => m.id === "m-1"
            );
            expect(after?.mentions.some((mn) => mn.mentionedUserId === "u-me")).toBe(true);
        } finally {
            localStorage.removeItem("userId");
        }
    });
});
