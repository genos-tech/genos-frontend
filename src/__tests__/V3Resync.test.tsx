/**
 * Reconnect resync replay tests.
 *
 * Covers:
 *   - `applyResyncBatch` upserts top-level + thread messages, applies
 *     hard-deletes, and advances per-channel checkpoints.
 *   - `force_full_reload` evicts the channel's stored rows BEFORE the
 *     replay is applied.
 *   - `triggerResync` reads the earliest checkpoint across channels +
 *     emits with that as `since`, then applies the returned batch.
 *   - Concurrent `triggerResync` calls share one in-flight promise.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
    type Channel,
    type DeltaEnvelope,
    type Message,
    type MessagesDeltaData,
} from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

type ResyncEnvelopeData = MessagesDeltaData & { thread_messages?: Message[] };
type ResyncBatchShape = {
    channels: Array<{ channel_id: string; envelope: DeltaEnvelope<ResyncEnvelopeData> }>;
    errors?: Array<{ channel_id: string; error: string }>;
};

function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
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

function envelope(
    serverTime: string,
    topMessages: Message[] = [],
    threadMessages: Message[] = [],
    deletes: string[] = [],
    forceFullReload = false
): DeltaEnvelope<ResyncEnvelopeData> {
    const env: DeltaEnvelope<ResyncEnvelopeData> = {
        server_time: serverTime,
        data: {
            messages: topMessages,
            thread_messages: threadMessages,
            deletes,
        },
    };
    if (forceFullReload) env.force_full_reload = true;
    return env;
}

function stubCheckpoints(): {
    getCheckpoint: ReturnType<typeof vi.fn>;
    setCheckpoint: ReturnType<typeof vi.fn>;
    store: Map<string, string>;
} {
    const store = new Map<string, string>();
    const stub = {
        store,
        getCheckpoint: vi.fn(async (k: string) => store.get(k) ?? null),
        setCheckpoint: vi.fn(async (k: string, v: string) => {
            store.set(k, v);
        }),
    };
    (channelService as unknown as { _checkpointRepo: typeof stub })._checkpointRepo = stub;
    return stub;
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
        _resyncInflight: Promise<number> | null;
    };
    svc._inflightSyncByChannel.clear();
    svc._resyncInflight = null;
    await channelService.hydrateFromIDB();
}

describe("applyResyncBatch", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("upserts top-level messages from each per-channel envelope", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const batch: ResyncBatchShape = {
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope("2026-05-29T10:00:00Z", [
                        fakeMessage("m-1", "c-1", { tsSent: "2026-05-29T09:00:00Z" }),
                        fakeMessage("m-2", "c-1", { tsSent: "2026-05-29T09:30:00Z" }),
                    ]),
                },
            ],
        };
        await channelService.applyResyncBatch(batch);
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.map((m) => m.id)).toEqual(["m-1", "m-2"]);
    });

    it("upserts thread messages alongside top-level", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const batch: ResyncBatchShape = {
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope(
                        "2026-05-29T10:00:00Z",
                        [fakeMessage("m-root", "c-1")],
                        [
                            fakeMessage("m-r1", "c-1", {
                                isThreadReply: true,
                                threadRootId: "m-root",
                                parentId: "m-root",
                                tsSent: "2026-05-29T09:30:00Z",
                            }),
                            fakeMessage("m-r2", "c-1", {
                                isThreadReply: true,
                                threadRootId: "m-root",
                                parentId: "m-root",
                                tsSent: "2026-05-29T09:45:00Z",
                            }),
                        ]
                    ),
                },
            ],
        };
        await channelService.applyResyncBatch(batch);
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-root")).toBeDefined();
        expect(msgs.filter((m) => m.isThreadReply).map((m) => m.id)).toEqual(["m-r1", "m-r2"]);
    });

    it("hard-deletes the ids in data.deletes", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-gone", "c-1"));
        channelService.handleMessageCreated(fakeMessage("m-keep", "c-1"));
        const batch: ResyncBatchShape = {
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope("2026-05-29T10:00:00Z", [], [], ["m-gone"]),
                },
            ],
        };
        await channelService.applyResyncBatch(batch);
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-gone")).toBeUndefined();
        expect(msgs.find((m) => m.id === "m-keep")).toBeDefined();
    });

    it("advances BOTH per-channel checkpoints to envelope.server_time", async () => {
        const cp = stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const batch: ResyncBatchShape = {
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope("2026-05-29T12:00:00Z", [fakeMessage("m-1", "c-1")]),
                },
            ],
        };
        await channelService.applyResyncBatch(batch);
        expect(cp.setCheckpoint).toHaveBeenCalledWith("v3:msgs:c-1", "2026-05-29T12:00:00Z");
        expect(cp.setCheckpoint).toHaveBeenCalledWith("v3:thrd:c-1", "2026-05-29T12:00:00Z");
    });

    it("force_full_reload evicts the channel's stored rows BEFORE applying", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        // Seed both a top-level and a thread reply that should be wiped.
        channelService.handleMessageCreated(fakeMessage("m-stale-top", "c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-stale-reply", "c-1", {
                isThreadReply: true,
                threadRootId: "m-stale-top",
                parentId: "m-stale-top",
            })
        );
        const batch: ResyncBatchShape = {
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope(
                        "2026-05-29T13:00:00Z",
                        [fakeMessage("m-fresh", "c-1")],
                        [],
                        [],
                        true /* force_full_reload */
                    ),
                },
            ],
        };
        await channelService.applyResyncBatch(batch);
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-stale-top")).toBeUndefined();
        expect(msgs.find((m) => m.id === "m-stale-reply")).toBeUndefined();
        expect(msgs.find((m) => m.id === "m-fresh")).toBeDefined();
    });

    it("returns the count of successfully applied envelopes", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleChannelCreated(fakeChannel("c-2"));
        const batch: ResyncBatchShape = {
            channels: [
                { channel_id: "c-1", envelope: envelope("2026-05-29T10:00:00Z") },
                { channel_id: "c-2", envelope: envelope("2026-05-29T10:00:01Z") },
            ],
        };
        const count = await channelService.applyResyncBatch(batch);
        expect(count).toBe(2);
    });
});

describe("triggerResync", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns 0 when no channels are in the store (skips the emit)", async () => {
        stubCheckpoints();
        const spy = vi.spyOn(channelService, "resync").mockResolvedValue(undefined);
        const n = await channelService.triggerResync();
        expect(n).toBe(0);
        expect(spy).not.toHaveBeenCalled();
    });

    it("sends the EARLIEST checkpoint as the global since", async () => {
        const cp = stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleChannelCreated(fakeChannel("c-2"));
        // c-1 is older than c-2.
        await cp.setCheckpoint("v3:msgs:c-1", "2026-05-29T08:00:00Z");
        await cp.setCheckpoint("v3:thrd:c-1", "2026-05-29T08:30:00Z");
        await cp.setCheckpoint("v3:msgs:c-2", "2026-05-29T09:00:00Z");
        await cp.setCheckpoint("v3:thrd:c-2", "2026-05-29T09:30:00Z");

        const spy = vi.spyOn(channelService, "resync").mockResolvedValue({ channels: [] });

        await channelService.triggerResync();
        expect(spy).toHaveBeenCalledWith(
            expect.arrayContaining(["c-1", "c-2"]),
            "2026-05-29T08:00:00Z"
        );
    });

    it("falls back to no since when ANY channel has no checkpoint", async () => {
        const cp = stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleChannelCreated(fakeChannel("c-2"));
        // c-1 has checkpoints; c-2 doesn't.
        await cp.setCheckpoint("v3:msgs:c-1", "2026-05-29T08:00:00Z");
        await cp.setCheckpoint("v3:thrd:c-1", "2026-05-29T08:30:00Z");

        const spy = vi.spyOn(channelService, "resync").mockResolvedValue({ channels: [] });

        await channelService.triggerResync();
        expect(spy).toHaveBeenCalledWith(expect.arrayContaining(["c-1", "c-2"]), undefined);
    });

    it("applies the returned batch to the store", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        vi.spyOn(channelService, "resync").mockResolvedValue({
            channels: [
                {
                    channel_id: "c-1",
                    envelope: envelope("2026-05-29T10:00:00Z", [fakeMessage("m-replay", "c-1")]),
                },
            ],
        });
        await channelService.triggerResync();
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-replay")).toBeDefined();
    });

    it("concurrent calls share one in-flight promise", async () => {
        stubCheckpoints();
        channelService.handleChannelCreated(fakeChannel("c-1"));
        let resolveResync: ((v: ResyncBatchShape) => void) | null = null;
        const spy = vi.spyOn(channelService, "resync").mockImplementation(
            () =>
                new Promise<ResyncBatchShape>((res) => {
                    resolveResync = res;
                })
        );

        const a = channelService.triggerResync();
        const b = channelService.triggerResync();
        const c = channelService.triggerResync();
        expect(a).toBe(b);
        expect(b).toBe(c);

        await vi.waitFor(() => expect(spy).toHaveBeenCalled());
        resolveResync!({ channels: [] });
        await a;
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
