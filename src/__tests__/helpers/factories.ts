/**
 * Canonical test fixtures for the unified `/api/v3/channels/` wire shapes.
 *
 * Type-COMPLETE against src/types/channel.ts (includes the PM-only
 * `taskId`/`displayId`/`taskStatus` on Message and `legacyChatId` on
 * Channel that the older per-file factories omit). New tests should import
 * from here; existing V3*.test factories can migrate to it to clear their
 * `tsc -b` fixture drift.
 */

import {
    ChannelKind,
    type Channel,
    type Message,
    type MessageReaction,
    type UserLite,
} from "../../types/channel";

export function fakeUser(name = "Alice", overrides: Partial<UserLite> = {}): UserLite {
    return {
        userId: `u-${name.toLowerCase()}`,
        userName: name,
        userEmail: `${name.toLowerCase()}@example.test`,
        avatarImgPath: null,
        isSystemUser: false,
        ...overrides,
    };
}

export function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        legacyChatId: null,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

export function fakeMessage(
    id: string,
    channelId: string,
    overrides: Partial<Message> = {}
): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: fakeUser(),
        seq: 1,
        body: [],
        bodyText: "",
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

export function fakeReaction(
    id: string,
    overrides: Partial<MessageReaction> = {}
): MessageReaction {
    return {
        id,
        user: fakeUser(),
        emoji: "👍",
        tsSent: "2026-01-01T00:00:02Z",
        ...overrides,
    };
}
