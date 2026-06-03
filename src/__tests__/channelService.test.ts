/**
 * In-memory channelService behavior tests.
 *
 * Focused on the reactive store + event handlers — the parts that don't
 * touch IDB or the network. IDB persistence is fire-and-forget in the
 * service; failures are logged but don't break in-memory state. To
 * keep these tests fast we stub `initDB()` to throw so the persistence
 * paths exit through their `catch` blocks (and we silence the warn
 * spew so the test output stays clean).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message, type ReadCursor } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

// Silence the [ChannelService] warnings from the persistence paths
// catching the stubbed IDB rejection. Restored in afterAll.
const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function makeChannel(overrides: Partial<Channel> = {}): Channel {
    return {
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
    };
}

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
        body: [],
        bodyText: "hello",
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

describe("channelService reactive store", () => {
    let svc: ChannelService;
    beforeEach(() => {
        svc = new ChannelService();
        svc.setCurrentUserId("user-me");
    });

    it("subscribers fire on handleMessageCreated and snapshot is fresh", () => {
        const fn = vi.fn();
        const unsub = svc.subscribe(fn);

        const before = svc.getSnapshot();
        svc.handleChannelCreated(makeChannel());
        const after = svc.getSnapshot();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(after).not.toBe(before);
        expect(after.channels.get("ch-1")?.title).toBe("Test");

        unsub();
    });

    it("handleMessageCreated bumps unread for incoming, not for self-sent", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));

        // Incoming from someone else
        svc.handleMessageCreated(
            makeMessage({
                id: "m-incoming",
                sender: {
                    userId: "user-other",
                    userName: "Other",
                    userEmail: "o@x",
                    avatarImgPath: null,
                    isSystemUser: false,
                },
            })
        );
        expect(svc.getSnapshot().channels.get("ch-1")?.unreadCount).toBe(1);

        // Self-sent
        svc.handleMessageCreated(
            makeMessage({
                id: "m-mine",
                sender: {
                    userId: "user-me",
                    userName: "Me",
                    userEmail: "m@x",
                    avatarImgPath: null,
                    isSystemUser: false,
                },
                tsSent: "2026-01-01T00:00:02Z",
            })
        );
        expect(svc.getSnapshot().channels.get("ch-1")?.unreadCount).toBe(1);
    });

    it("handleMessageCreated updates channel.latestMessage by tsSent", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-old", tsSent: "2026-01-01T00:00:01Z" }));
        svc.handleMessageCreated(makeMessage({ id: "m-new", tsSent: "2026-01-01T00:00:05Z" }));
        svc.handleMessageCreated(
            // Earlier ts — must NOT replace the latest.
            makeMessage({ id: "m-stale", tsSent: "2026-01-01T00:00:03Z" })
        );

        const ch = svc.getSnapshot().channels.get("ch-1");
        expect(ch?.latestMessage?.id).toBe("m-new");
    });

    it("handleMessageDeleted soft-deletes (sets deletedAt) without removing the row", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-1" }));

        svc.handleMessageDeleted({
            id: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
        });

        const arr = svc.getSnapshot().messagesByChannel.get("ch-1") ?? [];
        expect(arr).toHaveLength(1);
        expect(arr[0].deletedAt).toBeTruthy();
    });

    it("handleReactionAdded is idempotent on duplicate event delivery", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-1" }));

        const reaction = {
            id: "r-1",
            user: {
                userId: "user-other",
                userName: "Other",
                userEmail: "o@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
            emoji: "👍",
            tsSent: "2026-01-01T00:00:10Z",
        };
        svc.handleReactionAdded({
            messageId: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            reaction,
        });
        svc.handleReactionAdded({
            messageId: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            reaction,
        });

        const arr = svc.getSnapshot().messagesByChannel.get("ch-1") ?? [];
        expect(arr[0].reactions).toHaveLength(1);
    });

    it("handleReactionRemoved matches by (userId, emoji)", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-1" }));
        svc.handleReactionAdded({
            messageId: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            reaction: {
                id: "r-1",
                user: {
                    userId: "user-other",
                    userName: "Other",
                    userEmail: "o@x",
                    avatarImgPath: null,
                    isSystemUser: false,
                },
                emoji: "👍",
                tsSent: "2026-01-01T00:00:10Z",
            },
        });

        svc.handleReactionRemoved({
            messageId: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            userId: "user-other",
            emoji: "👍",
        });

        const arr = svc.getSnapshot().messagesByChannel.get("ch-1") ?? [];
        expect(arr[0].reactions).toHaveLength(0);
    });

    it("handleReadAdvanced resets the channel's unreadCount to 0", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1", unreadCount: 5 }));
        const cursor: ReadCursor = {
            id: "cur-1",
            channelId: "ch-1",
            threadRootId: null,
            lastReadMessageId: "m-1",
            lastReadAt: "2026-01-01T00:00:30Z",
        };
        svc.handleReadAdvanced(cursor);

        const snap = svc.getSnapshot();
        expect(snap.channels.get("ch-1")?.unreadCount).toBe(0);
        expect(snap.cursorsByChannel.get("ch-1")?.lastReadMessageId).toBe("m-1");
    });

    it("handleChannelMemberRemoved drops the channel when removing self", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleChannelMemberAdded({
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            member: {
                id: "mem-1",
                userId: "user-me",
                role: "member",
                tsJoined: "2026-01-01T00:00:00Z",
            },
        });
        expect(svc.getSnapshot().channels.has("ch-1")).toBe(true);

        svc.handleChannelMemberRemoved({
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            userId: "user-me",
        });

        expect(svc.getSnapshot().channels.has("ch-1")).toBe(false);
    });

    it("handleChannelMemberRemoved keeps the channel when someone else leaves", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleChannelMemberAdded({
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            member: {
                id: "mem-other",
                userId: "user-other",
                role: "member",
                tsJoined: "2026-01-01T00:00:00Z",
            },
        });

        svc.handleChannelMemberRemoved({
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            userId: "user-other",
        });

        expect(svc.getSnapshot().channels.has("ch-1")).toBe(true);
        expect(svc.getSnapshot().membersByChannel.get("ch-1")).toHaveLength(0);
    });

    it("applyResyncBatch upserts messages from each per-channel envelope", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));

        svc.applyResyncBatch({
            channels: [
                {
                    channel_id: "ch-1",
                    envelope: {
                        server_time: "2026-01-01T00:00:30Z",
                        data: {
                            messages: [
                                makeMessage({ id: "m-replay-1", tsSent: "2026-01-01T00:00:10Z" }),
                                makeMessage({ id: "m-replay-2", tsSent: "2026-01-01T00:00:20Z" }),
                            ],
                            deletes: [],
                        },
                    },
                },
            ],
        });

        const arr = svc.getSnapshot().messagesByChannel.get("ch-1") ?? [];
        expect(arr.map((m) => m.id)).toEqual(["m-replay-1", "m-replay-2"]);
    });

    it("send() queues instead of rejecting when the socket is not connected", () => {
        // Previously: `send()` rejected with DISCONNECTED when no socket.
        // New contract (pending-queue): the message is enqueued at status
        // "queued" and the returned Promise stays pending until a later
        // `flushPendingQueue()` (on reconnect) drains it.
        const promise = svc.send("ch-1", [{ t: "p" }]);
        // Promise hangs — no synchronous rejection.
        expect(promise).toBeInstanceOf(Promise);
        const snap = svc.getSnapshot();
        const pending = snap.pendingByChannel.get("ch-1") ?? [];
        expect(pending).toHaveLength(1);
        expect(pending[0]?.status).toBe("queued");
        // Clean up so the dangling Promise doesn't leak into the next test.
        svc.discardPending(pending[0]!.correlationId);
        // Attach a no-op catch so the rejection-from-discard doesn't
        // log as unhandled.
        promise.catch(() => undefined);
    });

    it("markRead() resolves to a no-op instead of rejecting when the socket is not connected", async () => {
        // Regression: read.advance is best-effort + forward-only, so a
        // disconnected emit must NOT reject. Previously it threw
        // DISCONNECTED ("Socket not connected; cannot emit read.advance"),
        // which surfaced as a noisy console.error on every chat open that
        // raced the socket handshake. No socket is set in this suite, so
        // this exercises the disconnected branch directly.
        await expect(svc.markRead("ch-1", "m-1")).resolves.toBeUndefined();
    });

    it("markRead() emits read.advance when the socket is connected", async () => {
        const emit = vi.fn(
            (_event: string, _payload: Record<string, unknown>, ack: (a: unknown) => void) => {
                ack({
                    ok: true,
                    data: {
                        id: "cur-1",
                        channelId: "ch-1",
                        threadRootId: null,
                        lastReadMessageId: "m-1",
                        lastReadAt: "2026-01-01T00:00:05Z",
                    } satisfies ReadCursor,
                });
            }
        );
        svc.setSocket({ connected: true, emit } as unknown as Parameters<typeof svc.setSocket>[0]);

        const cursor = await svc.markRead("ch-1", "m-1");

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit.mock.calls[0]?.[0]).toBe("read.advance");
        expect(emit.mock.calls[0]?.[1]).toMatchObject({
            channel_id: "ch-1",
            last_read_message_id: "m-1",
            thread_root_id: null,
        });
        expect(cursor?.lastReadMessageId).toBe("m-1");
    });
});
