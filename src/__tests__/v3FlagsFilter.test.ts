// v3FlagsToLegacy `filter` param — the active/completed split that feeds
// the active flagged list vs the past-flagged view off one snapshot.

import { describe, expect, it } from "vitest";

import { v3FlagsToLegacy } from "../features/chat/adapters/v3ToLegacy";
import { ChannelKind, type Channel, type Flag, type Message } from "../types/channel";

const channel: Channel = {
    id: "c-1",
    kind: ChannelKind.GM,
    title: "Team",
    profileImageUrl: "",
    projectId: null,
    ownerId: null,
    isPrivate: false,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
};

const message = (id: string): Message => ({
    id,
    channelId: "c-1",
    channelKind: ChannelKind.GM,
    sender: {
        userId: "u-a",
        userName: "A",
        userEmail: "a@x",
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
});

const build = (filter?: "active" | "completed") =>
    v3FlagsToLegacy({
        flags: new Map<string, Flag>([
            [
                "f-active",
                { id: "f-active", messageId: "m-active", tsCreated: "2026-01-02T00:00:00Z" },
            ],
            [
                "f-done",
                {
                    id: "f-done",
                    messageId: "m-done",
                    tsCreated: "2026-01-02T00:00:00Z",
                    completedAt: "2026-01-03T00:00:00Z",
                },
            ],
        ]),
        channels: new Map([["c-1", channel]]),
        membersByChannel: new Map(),
        messagesByChannel: new Map([["c-1", [message("m-active"), message("m-done")]]]),
        currentUserId: "u-me",
        filter,
    });

describe("v3FlagsToLegacy filter", () => {
    it("defaults to active (excludes completed flags)", () => {
        expect(build().map((r) => r.flaggedMessageId)).toEqual(["f-active"]);
    });

    it("filter=active yields only outstanding flags", () => {
        expect(build("active").map((r) => r.flaggedMessageId)).toEqual(["f-active"]);
    });

    it("filter=completed yields only completed flags", () => {
        expect(build("completed").map((r) => r.flaggedMessageId)).toEqual(["f-done"]);
    });
});
