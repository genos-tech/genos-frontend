// Pure matcher for the reaction-seen clear: index the activity store by
// reacted-to message UUID, then re-validate resolved ids against the latest
// store before clearing. See src/features/chat/utils/reactionSeenMatch.ts.

import { describe, expect, it } from "vitest";

import {
    buildReactionSeenIndex,
    clearableRowsForIds,
} from "../features/chat/utils/reactionSeenMatch";
import type { ActivityMessageProps } from "../types/chat";

function activity(overrides: Partial<ActivityMessageProps> = {}): ActivityMessageProps {
    return {
        activityId: "act-1",
        activityType: 2, // REACTION
        chatType: 2,
        chatId: 0,
        chatName: "GM",
        dmPartnerUserId: "",
        dmPartnerUserName: "",
        dmPartnerUserEmail: "",
        isThread: false,
        threadId: 0,
        messageId: 0,
        messageUniqueKey: "msg-uuid-1",
        threadMessageUniqueKey: "",
        taskId: 0,
        firstLineContent: "hi",
        latestReaction: { emoji: "👍", sender: {} as never, tsSent: "" },
        senderId: "author",
        receiver: {} as never,
        reactions: [],
        tsSent: "2026-01-01T00:00:00Z",
        isRead: false,
        ...overrides,
    };
}

describe("buildReactionSeenIndex", () => {
    it("indexes only UNREAD reaction rows by messageUniqueKey", () => {
        const index = buildReactionSeenIndex([
            activity({ activityId: "r1", messageUniqueKey: "m1", isRead: false }),
            activity({ activityId: "r2", messageUniqueKey: "m2", isRead: true }), // read → skip
            activity({ activityId: "m3msg", activityType: 5, messageUniqueKey: "m3" }), // not reaction → skip
        ]);
        expect(index.get("m1")).toEqual(["r1"]);
        expect(index.has("m2")).toBe(false);
        expect(index.has("m3")).toBe(false);
    });

    it("maps one message to several reaction activities (different reactors)", () => {
        const index = buildReactionSeenIndex([
            activity({ activityId: "r1", messageUniqueKey: "m1" }),
            activity({ activityId: "r2", messageUniqueKey: "m1" }),
        ]);
        expect(index.get("m1")).toEqual(["r1", "r2"]);
    });

    it("indexes a thread-reply reaction under both key fields", () => {
        const index = buildReactionSeenIndex([
            activity({
                activityId: "r1",
                isThread: true,
                messageUniqueKey: "tm1",
                threadMessageUniqueKey: "tm1",
            }),
        ]);
        // Same UUID in both fields → one key, not duplicated.
        expect(index.get("tm1")).toEqual(["r1"]);
    });

    it("indexes under a distinct threadMessageUniqueKey when it differs", () => {
        const index = buildReactionSeenIndex([
            activity({
                activityId: "r1",
                messageUniqueKey: "a",
                threadMessageUniqueKey: "b",
            }),
        ]);
        expect(index.get("a")).toEqual(["r1"]);
        expect(index.get("b")).toEqual(["r1"]);
    });

    it("ignores empty key fields", () => {
        const index = buildReactionSeenIndex([
            activity({ activityId: "r1", messageUniqueKey: "", threadMessageUniqueKey: "" }),
        ]);
        expect(index.size).toBe(0);
    });
});

describe("clearableRowsForIds", () => {
    const store = [
        activity({ activityId: "r1", isRead: false }),
        activity({ activityId: "r2", isRead: true }), // already cleared elsewhere
        activity({ activityId: "r3", isRead: false }),
    ];

    it("returns only the still-unread rows for the given ids", () => {
        const rows = clearableRowsForIds(["r1", "r2", "r3"], store);
        expect(rows.map((r) => r.activityId).sort()).toEqual(["r1", "r3"]);
    });

    it("drops an id already flipped read between seen and flush", () => {
        expect(clearableRowsForIds(["r2"], store)).toEqual([]);
    });

    it("ignores ids not in the store", () => {
        expect(clearableRowsForIds(["ghost"], store)).toEqual([]);
    });
});
