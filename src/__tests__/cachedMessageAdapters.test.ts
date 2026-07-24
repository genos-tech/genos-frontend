/**
 * Identity-caching adapter tests.
 *
 * The live-update bridges in `useChatManagement` re-adapt the whole v3
 * message slice on every store notify that touches the open channel.
 * `MessageBubble` / `ThreadMessageBubble` are memoized on
 * `prev.message === next.message`, so the adapter's OUTPUT identity is
 * the render contract: an unchanged row must come back as the same
 * object, and a no-op re-adapt must return the same array — otherwise
 * every visible BlockNote-backed bubble re-renders on every event.
 */

import { describe, expect, it } from "vitest";

import {
    createCachedMessagesAdapter,
    createCachedThreadMessagesAdapter,
} from "../features/chat/adapters/v3ToLegacy";
import { ChannelKind, type Message } from "../types/channel";

function makeMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: "m-1",
        channelId: "ch-1",
        channelKind: ChannelKind.GM,
        sender: {
            userId: "user-a",
            userName: "Alice",
            userEmail: "a@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [{ type: "paragraph", content: [] }],
        bodyText: "hello",
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

const noFlags = { has: () => false };

describe("createCachedMessagesAdapter", () => {
    it("returns the same array for an unchanged input", () => {
        const adapt = createCachedMessagesAdapter();
        const messages = [
            makeMessage({ id: "m-1", tsSent: "2026-01-01T00:00:01Z" }),
            makeMessage({ id: "m-2", tsSent: "2026-01-01T00:00:02Z" }),
        ];
        const args = { messages, channelId: "ch-1", chatType: 2, flaggedMessageIds: noFlags };
        const first = adapt(args);
        const second = adapt({ ...args, messages: [...messages] });
        expect(second).toBe(first);
    });

    it("keeps unchanged rows' identity when a new message arrives", () => {
        const adapt = createCachedMessagesAdapter();
        const m1 = makeMessage({ id: "m-1", tsSent: "2026-01-01T00:00:01Z" });
        const m2 = makeMessage({ id: "m-2", tsSent: "2026-01-01T00:00:02Z" });
        const first = adapt({
            messages: [m1, m2],
            channelId: "ch-1",
            chatType: 2,
            flaggedMessageIds: noFlags,
        });
        const m3 = makeMessage({ id: "m-3", tsSent: "2026-01-01T00:00:03Z" });
        const second = adapt({
            messages: [m1, m2, m3],
            channelId: "ch-1",
            chatType: 2,
            flaggedMessageIds: noFlags,
        });
        expect(second).not.toBe(first);
        expect(second).toHaveLength(3);
        // The two old rows come back as the SAME adapted objects — this
        // is what lets the per-bubble React.memo hold for them.
        expect(second[0]).toBe(first[0]);
        expect(second[1]).toBe(first[1]);
    });

    it("re-adapts a row when its source object or flag bit changes", () => {
        const adapt = createCachedMessagesAdapter();
        const m1 = makeMessage({ id: "m-1" });
        const base = { channelId: "ch-1", chatType: 2 };
        const first = adapt({ ...base, messages: [m1], flaggedMessageIds: noFlags });

        // Source object replaced (channelService upserts a new object on
        // any row mutation) → new adapted row.
        const edited = { ...m1, bodyText: "edited" };
        const second = adapt({ ...base, messages: [edited], flaggedMessageIds: noFlags });
        expect(second[0]).not.toBe(first[0]);
        expect(second[0]?.contentText).toBe("edited");

        // Same source, flag bit flipped → new adapted row with the flag.
        const third = adapt({
            ...base,
            messages: [edited],
            flaggedMessageIds: { has: (id: string) => id === "m-1" },
        });
        expect(third[0]).not.toBe(second[0]);
        expect(third[0]?.isFlagged).toBe(true);
    });

    it("still filters thread replies, deleted rows and PM orphans", () => {
        const adapt = createCachedMessagesAdapter();
        const rows = [
            makeMessage({ id: "top", tsSent: "2026-01-01T00:00:01Z" }),
            makeMessage({
                id: "reply",
                isThreadReply: true,
                parentId: "top",
                tsSent: "2026-01-01T00:00:02Z",
            }),
            makeMessage({
                id: "gone",
                deletedAt: "2026-01-02T00:00:00Z",
                tsSent: "2026-01-01T00:00:03Z",
            }),
        ];
        const out = adapt({
            messages: rows,
            channelId: "ch-1",
            chatType: 2,
            flaggedMessageIds: noFlags,
        });
        expect(out.map((m) => m.messageIdWithChatId)).toEqual(["top"]);

        // PM surface: top-level rows without a resolved taskId are
        // orphan cards and must not render.
        const pmAdapt = createCachedMessagesAdapter();
        const pmOut = pmAdapt({
            messages: [
                makeMessage({ id: "card", taskId: 42, channelKind: ChannelKind.PM }),
                makeMessage({ id: "orphan", channelKind: ChannelKind.PM }),
            ],
            channelId: "ch-pm",
            chatType: 3,
            flaggedMessageIds: noFlags,
        });
        expect(pmOut.map((m) => m.messageIdWithChatId)).toEqual(["card"]);
    });
});

describe("createCachedThreadMessagesAdapter", () => {
    it("returns [root, ...replies] with stable identities across re-adapts", () => {
        const adapt = createCachedThreadMessagesAdapter();
        const root = makeMessage({ id: "root", tsSent: "2026-01-01T00:00:01Z" });
        const r1 = makeMessage({
            id: "r-1",
            isThreadReply: true,
            parentId: "root",
            tsSent: "2026-01-01T00:00:02Z",
        });
        const args = {
            channelId: "ch-1",
            threadRootUuid: "root",
            chatType: 2,
            flaggedMessageIds: noFlags,
        };
        const first = adapt({ ...args, messages: [root, r1] });
        expect(first.map((m) => m.messageIdWithChatIdAndThreadId)).toEqual(["root", "r-1"]);

        // Unchanged input → same array.
        const second = adapt({ ...args, messages: [root, r1] });
        expect(second).toBe(first);

        // New reply → old rows keep identity, new row appended.
        const r2 = makeMessage({
            id: "r-2",
            isThreadReply: true,
            parentId: "root",
            tsSent: "2026-01-01T00:00:03Z",
        });
        const third = adapt({ ...args, messages: [root, r1, r2] });
        expect(third).toHaveLength(3);
        expect(third[0]).toBe(first[0]);
        expect(third[1]).toBe(first[1]);
    });

    it("returns [] when the root is missing or deleted", () => {
        const adapt = createCachedThreadMessagesAdapter();
        const args = {
            channelId: "ch-1",
            threadRootUuid: "root",
            chatType: 2,
            flaggedMessageIds: noFlags,
        };
        expect(adapt({ ...args, messages: [] })).toEqual([]);
        const deletedRoot = makeMessage({ id: "root", deletedAt: "2026-01-02T00:00:00Z" });
        expect(adapt({ ...args, messages: [deletedRoot] })).toEqual([]);
    });
});
