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

import axios from "axios";
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

    it("send({echo}) renders an optimistic row immediately and swaps it for the server row", async () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        const sender = {
            userId: "user-me",
            userName: "Me",
            userEmail: "m@x",
            avatarImgPath: null,
            isSystemUser: false,
        };

        // Socket down → the send queues, but the echo row must render NOW.
        const promise = svc.send("ch-1", [{ t: "p" }], { bodyText: "hi", echo: { sender } });
        const snap = svc.getSnapshot();
        const pending = (snap.pendingByChannel.get("ch-1") ?? [])[0];
        expect(pending?.echoMessageId).toBe(pending?.correlationId);
        const arr = snap.messagesByChannel.get("ch-1") ?? [];
        expect(arr.map((m) => m.id)).toEqual([pending!.correlationId]);
        expect(arr[0]?.bodyText).toBe("hi");
        expect(arr[0]?.sender?.userId).toBe("user-me");
        // Sidebar preview follows the echo…
        expect(snap.channels.get("ch-1")?.latestMessage?.id).toBe(pending!.correlationId);
        // …but nothing was persisted (IDB is stubbed off here anyway; the
        // contract is that the echo never reaches `_persistMessage`) and
        // unread did not bump for a self-sent row.
        expect(snap.channels.get("ch-1")?.unreadCount).toBe(0);

        // The broadcast (or delayed ack catch-up) carries the same
        // correlation id → echo replaced by the server row, no duplicate.
        const serverRow = {
            ...makeMessage({
                id: "m-server",
                bodyText: "hi",
                tsSent: "2026-01-01T00:00:09Z",
                sender,
            }),
            correlation_id: pending!.correlationId,
        };
        svc.handleMessageCreated(serverRow as never);

        const after = svc.getSnapshot();
        const afterArr = after.messagesByChannel.get("ch-1") ?? [];
        expect(afterArr.map((m) => m.id)).toEqual(["m-server"]);
        expect(after.channels.get("ch-1")?.latestMessage?.id).toBe("m-server");
        expect(after.pendingByChannel.get("ch-1")).toBeUndefined();
        await expect(promise).resolves.toMatchObject({ id: "m-server" });
    });

    it("discardPending removes the optimistic echo row and repairs latestMessage", async () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-real", tsSent: "2026-01-01T00:00:01Z" }));
        const sender = {
            userId: "user-me",
            userName: "Me",
            userEmail: "m@x",
            avatarImgPath: null,
            isSystemUser: false,
        };
        const promise = svc.send("ch-1", [{ t: "p" }], { bodyText: "oops", echo: { sender } });
        promise.catch(() => undefined);
        const corr = (svc.getSnapshot().pendingByChannel.get("ch-1") ?? [])[0]!.correlationId;
        expect(svc.getSnapshot().channels.get("ch-1")?.latestMessage?.id).toBe(corr);

        svc.discardPending(corr);

        const after = svc.getSnapshot();
        expect((after.messagesByChannel.get("ch-1") ?? []).map((m) => m.id)).toEqual(["m-real"]);
        // latestMessage falls back to the newest surviving top-level row.
        expect(after.channels.get("ch-1")?.latestMessage?.id).toBe("m-real");
        await expect(promise).rejects.toMatchObject({ code: "DISCARDED" });
    });

    it("ingestMessages applies a batch under a single notify", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        const fn = vi.fn();
        const unsub = svc.subscribe(fn);

        svc.ingestMessages([
            makeMessage({ id: "b-1", tsSent: "2026-01-01T00:00:01Z" }),
            makeMessage({ id: "b-2", tsSent: "2026-01-01T00:00:02Z" }),
            makeMessage({ id: "b-3", tsSent: "2026-01-01T00:00:03Z" }),
        ]);

        expect(fn).toHaveBeenCalledTimes(1);
        const arr = svc.getSnapshot().messagesByChannel.get("ch-1") ?? [];
        expect(arr.map((m) => m.id)).toEqual(["b-1", "b-2", "b-3"]);
        unsub();
    });

    it("ingestChannels lands a list under a single notify and bumps channelsVersion", () => {
        const fn = vi.fn();
        const unsub = svc.subscribe(fn);
        const before = svc.getSnapshot().channelsVersion;

        svc.ingestChannels([
            makeChannel({ id: "ch-a" }),
            makeChannel({ id: "ch-b" }),
            makeChannel({ id: "ch-c" }),
        ]);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(svc.getSnapshot().channels.size).toBe(3);
        expect(svc.getSnapshot().channelsVersion).toBeGreaterThan(before);
        unsub();
    });

    it("channelsVersion ignores message-only events but tracks latest/unread changes", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        svc.handleMessageCreated(makeMessage({ id: "m-1", tsSent: "2026-01-01T00:00:01Z" }));
        const afterCreate = svc.getSnapshot().channelsVersion;

        // A reaction touches only the message — the chat list shouldn't
        // re-derive for it.
        svc.handleReactionAdded({
            messageId: "m-1",
            channelId: "ch-1",
            channelKind: ChannelKind.GM,
            reaction: {
                id: "r-1",
                emoji: "👍",
                user: {
                    userId: "user-b",
                    userName: "Bee",
                    userEmail: "b@x",
                    avatarImgPath: null,
                    isSystemUser: false,
                },
                tsSent: "2026-01-01T00:00:02Z",
            },
        });
        expect(svc.getSnapshot().channelsVersion).toBe(afterCreate);

        // A newer message moves the channel's latest → the list must see it.
        svc.handleMessageCreated(makeMessage({ id: "m-2", tsSent: "2026-01-01T00:00:05Z" }));
        expect(svc.getSnapshot().channelsVersion).toBeGreaterThan(afterCreate);
    });

    it("flagsVersion bumps when a flagged message's row is rewritten", () => {
        svc.handleChannelCreated(makeChannel({ id: "ch-1" }));
        const m = makeMessage({ id: "m-flagged", tsSent: "2026-01-01T00:00:01Z" });
        svc.handleMessageCreated(m);
        svc.handleFlagAdded({
            id: "f-1",
            messageId: "m-flagged",
            channelId: "ch-1",
            userId: "user-me",
            completedAt: null,
            tsCreated: "2026-01-01T00:00:02Z",
        } as never);
        const before = svc.getSnapshot().flagsVersion;

        // Content update of the flagged message → the flagged-list derive
        // must re-run (it renders message content).
        svc.handleMessageUpdated({ ...m, bodyText: "edited" });
        expect(svc.getSnapshot().flagsVersion).toBeGreaterThan(before);

        // An unrelated message write must NOT bump it.
        const mid = svc.getSnapshot().flagsVersion;
        svc.handleMessageCreated(makeMessage({ id: "m-plain", tsSent: "2026-01-01T00:00:03Z" }));
        expect(svc.getSnapshot().flagsVersion).toBe(mid);
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

    // `markRead` forwards the id to Django's `Message.id` UUIDField, so it
    // only emits for real UUIDs — hence the shaped ids here rather than the
    // "m-1" placeholders the rest of this suite uses.
    const MSG_UUID = "11111111-2222-4333-8444-555555555555";
    const ROOT_UUID = "99999999-8888-4777-8666-555555555555";

    it("markRead() emits read.advance when the socket is connected", async () => {
        const emit = vi.fn(
            (_event: string, _payload: Record<string, unknown>, ack: (a: unknown) => void) => {
                ack({
                    ok: true,
                    data: {
                        id: "cur-1",
                        channelId: "ch-1",
                        threadRootId: null,
                        lastReadMessageId: MSG_UUID,
                        lastReadAt: "2026-01-01T00:00:05Z",
                    } satisfies ReadCursor,
                });
            }
        );
        svc.setSocket({ connected: true, emit } as unknown as Parameters<typeof svc.setSocket>[0]);

        const cursor = await svc.markRead("ch-1", MSG_UUID);

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit.mock.calls[0]?.[0]).toBe("read.advance");
        expect(emit.mock.calls[0]?.[1]).toMatchObject({
            channel_id: "ch-1",
            last_read_message_id: MSG_UUID,
            thread_root_id: null,
        });
        expect(cursor?.lastReadMessageId).toBe(MSG_UUID);
    });

    it("markRead() resolves to undefined (does not reject) when the server rejects the emit", async () => {
        // Backend degraded: the socket is connected but the ack returns
        // ok=false (e.g. the socket server can't reach Django and times
        // out). markRead is best-effort + forward-only, so it must swallow
        // this rather than reject — otherwise every scroll tick floods the
        // console with markRead errors while the backend is down.
        const emit = vi.fn(
            (_event: string, _payload: Record<string, unknown>, ack: (a: unknown) => void) => {
                ack({ ok: false, code: "BACKEND_ERROR", message: "Read timed out" });
            }
        );
        svc.setSocket({ connected: true, emit } as unknown as Parameters<typeof svc.setSocket>[0]);

        await expect(svc.markRead("ch-1", MSG_UUID)).resolves.toBeUndefined();
        expect(emit).toHaveBeenCalledTimes(1);
    });

    it("markRead() does not emit an optimistic echo's correlation id", async () => {
        // An unacked message renders from an echo whose `id` IS its
        // `corr-<random>` correlation id, and callers pick the cursor by
        // "newest bubble" — so this is what they hand us right after a
        // send. Django looks the id up against a UUIDField, so forwarding
        // it was a 500 per send.
        const emit = vi.fn();
        svc.setSocket({ connected: true, emit } as unknown as Parameters<typeof svc.setSocket>[0]);

        await expect(svc.markRead("ch-1", "corr-iuxb112kesbmsiu9ms3")).resolves.toBeUndefined();
        expect(emit).not.toHaveBeenCalled();
    });

    it("markRead() does not emit a non-UUID thread root id", async () => {
        const emit = vi.fn();
        svc.setSocket({ connected: true, emit } as unknown as Parameters<typeof svc.setSocket>[0]);

        await expect(
            svc.markRead("ch-1", MSG_UUID, "corr-iuxb112kesbmsiu9ms3")
        ).resolves.toBeUndefined();
        expect(emit).not.toHaveBeenCalled();

        // …but a well-formed one still goes through.
        emit.mockImplementation(
            (_event: string, _payload: Record<string, unknown>, ack: (a: unknown) => void) =>
                ack({ ok: true, data: null })
        );
        await svc.markRead("ch-1", MSG_UUID, ROOT_UUID);
        expect(emit.mock.calls[0]?.[1]).toMatchObject({ thread_root_id: ROOT_UUID });
    });
});

/**
 * `listChannels` in-flight dedup — recovery after a failed call.
 *
 * Regression: the dedup slot used to be cleared in a `finally` INSIDE the
 * async body. An async function body runs synchronously up to its first
 * `await`, and `api()` throws on a missing token BEFORE that await — so the
 * clear ran while the assignment's right-hand side was still evaluating, and
 * the assignment then re-filled the slot with the already-rejected promise.
 *
 * The slot stayed poisoned for the life of the tab: every later caller got
 * the boot-time rejection replayed, with no HTTP issued, no matter that a
 * token had since landed. That froze the chat list on its IDB snapshot for
 * the whole session — a project created afterwards had no PM channel row, so
 * its icon/profile never rendered.
 */
describe("channelService.listChannels in-flight dedup", () => {
    it("recovers once a token lands after a token-less failure", async () => {
        const svc = new ChannelService();
        const get = vi.fn().mockResolvedValue({ data: { channels: [makeChannel()] } });
        vi.spyOn(axios, "create").mockReturnValue({ get } as never);

        // Boot: the mount effect fires before the async token refresh lands.
        svc.setAccessToken(null);
        await expect(svc.listChannels()).rejects.toThrow(/access token/i);
        expect(get).not.toHaveBeenCalled();

        // Token arrives. The next call must actually hit the network.
        svc.setAccessToken("tok-1");
        await expect(svc.listChannels()).resolves.toHaveLength(1);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("still coalesces concurrent callers into one request", async () => {
        const svc = new ChannelService();
        const get = vi.fn().mockResolvedValue({ data: { channels: [makeChannel()] } });
        vi.spyOn(axios, "create").mockReturnValue({ get } as never);
        svc.setAccessToken("tok-1");

        const [a, b] = await Promise.all([svc.listChannels(), svc.listChannels()]);

        expect(get).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
    });

    it("does not cache a rejection from a failed request", async () => {
        const svc = new ChannelService();
        const get = vi
            .fn()
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValue({ data: { channels: [makeChannel()] } });
        vi.spyOn(axios, "create").mockReturnValue({ get } as never);
        svc.setAccessToken("tok-1");

        await expect(svc.listChannels()).rejects.toThrow();
        // A retry must re-issue rather than replay the cached failure.
        await expect(svc.listChannels()).resolves.toHaveLength(1);
        expect(get).toHaveBeenCalledTimes(2);
    });
});

/**
 * `reconcileChannelList` — dropping channels the server no longer lists.
 *
 * Regression: `listChannels` only ever ADDED. Callers push each row through
 * `handleChannelCreated`, so a channel that vanished server-side lived on in
 * the snapshot and in IDB forever. The removal path
 * (`handleChannelMemberRemoved`) needs a live `channel.member_removed` event,
 * and a channel can vanish without one — deleting a project soft-deletes its
 * PM channel through a Django signal that emits nothing. The chat then sat in
 * the sidebar pointing at a project that no longer existed, 404ing
 * `sprint/config`, `milestone/list`, `messages`, `threads` and `members`.
 */
describe("channelService.reconcileChannelList", () => {
    it("drops a channel the server no longer lists", () => {
        const svc = new ChannelService();
        svc.handleChannelCreated(makeChannel({ id: "gone" }));
        svc.handleChannelCreated(makeChannel({ id: "kept" }));

        svc.reconcileChannelList([makeChannel({ id: "kept" })]);

        const ids = [...svc.getSnapshot().channels.keys()];
        expect(ids).toEqual(["kept"]);
    });

    it("keeps everything when the server still lists it all", () => {
        const svc = new ChannelService();
        svc.handleChannelCreated(makeChannel({ id: "a" }));
        svc.handleChannelCreated(makeChannel({ id: "b" }));

        svc.reconcileChannelList([makeChannel({ id: "a" }), makeChannel({ id: "b" })]);

        expect([...svc.getSnapshot().channels.keys()].sort()).toEqual(["a", "b"]);
    });

    it("clears an evicted channel's messages, cursors and members too", () => {
        const svc = new ChannelService();
        svc.handleChannelCreated(makeChannel({ id: "gone" }));
        svc.handleMessageCreated(makeMessage({ id: "m-1", channelId: "gone" }));

        svc.reconcileChannelList([]);

        const snap = svc.getSnapshot();
        expect(snap.channels.size).toBe(0);
        expect(snap.messagesByChannel.get("gone")).toBeUndefined();
        expect(snap.membersByChannel.get("gone")).toBeUndefined();
        expect(snap.cursorsByChannel.get("gone")).toBeUndefined();
    });

    it("empties the store when the user has no channels left", () => {
        const svc = new ChannelService();
        svc.handleChannelCreated(makeChannel({ id: "only" }));

        svc.reconcileChannelList([]);

        expect(svc.getSnapshot().channels.size).toBe(0);
    });

    it("is a no-op when nothing is stale — no needless notify", () => {
        const svc = new ChannelService();
        svc.handleChannelCreated(makeChannel({ id: "a" }));
        const before = svc.getSnapshot();

        svc.reconcileChannelList([makeChannel({ id: "a" })]);

        // Same snapshot identity => no re-render was triggered.
        expect(svc.getSnapshot()).toBe(before);
    });
});
