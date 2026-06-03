/**
 * channelToLegacyChat — self-sent unread clamp.
 *
 * The legacy sidebar derives "is this chat unread?" from `lastReadMessageId`
 * vs the latest seq. A channel whose latest top-level message is the current
 * user's own must read as "read" regardless of the server's `unreadCount`
 * denorm — you can't have an unread message you just sent, and markRead is
 * best-effort (so on a degraded backend the server's count can stay stale).
 */
import { describe, expect, it } from "vitest";

import { channelToLegacyChat } from "../features/chat/adapters/v3ToLegacy";
import { ChannelKind, type Channel, type Message } from "../types/channel";

const makeMessage = (senderUserId: string, seq: number): Message =>
    ({
        id: `m-${seq}`,
        channelId: "ch-1",
        channelKind: ChannelKind.GM,
        sender: {
            userId: senderUserId,
            userName: "U",
            userEmail: "u@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq,
        body: [],
        bodyText: "hi",
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
    }) as Message;

const makeChannel = (overrides: Partial<Channel>): Channel =>
    ({
        id: "ch-1",
        kind: ChannelKind.GM,
        title: "Test",
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    }) as Channel;

describe("channelToLegacyChat — self-sent unread clamp", () => {
    it("reads as read when the latest message is the current user's own, even if unreadCount > 0", () => {
        const channel = makeChannel({ unreadCount: 5, latestMessage: makeMessage("me", 10) });
        const legacy = channelToLegacyChat({ channel, isPinned: false, currentUserId: "me" });
        // lastReadMessageId === latest seq → countUnreadChats sees "read".
        expect(legacy.lastReadMessageId).toBe("10");
    });

    it("reads as unread when the latest message is from another user and unreadCount > 0", () => {
        const channel = makeChannel({ unreadCount: 5, latestMessage: makeMessage("other", 10) });
        const legacy = channelToLegacyChat({ channel, isPinned: false, currentUserId: "me" });
        expect(legacy.lastReadMessageId).toBe("0");
    });

    it("reads as read when unreadCount is 0 regardless of who sent the latest", () => {
        const channel = makeChannel({ unreadCount: 0, latestMessage: makeMessage("other", 10) });
        const legacy = channelToLegacyChat({ channel, isPinned: false, currentUserId: "me" });
        expect(legacy.lastReadMessageId).toBe("10");
    });
});
