/**
 * Per-channel sync checkpoint tests.
 *
 * Covers `channelService.syncChannel`:
 *   - first sync omits `?since=` (no checkpoint persisted yet) and
 *     persists the server-issued `server_time` afterwards.
 *   - second sync reads back the checkpoint and passes it as `?since=`.
 *   - concurrent calls for the same channelId share one in-flight
 *     promise (no overlapping REST hits).
 *   - failed REST leaves the checkpoint unmoved → next call re-fetches
 *     the same window.
 *   - `force_full_reload` evicts in-memory rows for the channel + the
 *     matching stream BEFORE applying the response.
 *   - `data.deletes` hard-removes matching rows.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import {
    ChannelKind,
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

/** Build the singleton `CheckpointRepository` instance the service
 *  lazily creates, then stub its read/write surface for assertions. */
function stubCheckpoints(): {
    getCheckpoint: ReturnType<typeof vi.fn>;
    setCheckpoint: ReturnType<typeof vi.fn>;
} {
    const store = new Map<string, string>();
    const stub = {
        getCheckpoint: vi.fn(async (k: string) => store.get(k) ?? null),
        setCheckpoint: vi.fn(async (k: string, v: string) => {
            store.set(k, v);
        }),
    };
    const svc = channelService as unknown as { _checkpointRepo: typeof stub };
    svc._checkpointRepo = stub;
    return stub;
}

/** Build a minimal DeltaEnvelope. */
function envelope(
    serverTime: string,
    messages: Message[] = [],
    deletes: string[] = [],
    forceFullReload = false
): DeltaEnvelope<MessagesDeltaData> {
    const env: DeltaEnvelope<MessagesDeltaData> = {
        server_time: serverTime,
        data: { messages, deletes },
    };
    if (forceFullReload) env.force_full_reload = true;
    return env;
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
    // Drop any leftover in-flight sync promises from a prior test. If a
    // test mocked `fetchMessagesDelta` with a never-resolving promise
    // and left it hanging, the entry persists in `_inflightSyncByChannel`
    // and would short-circuit the next test's `syncChannel(...)` call
    // back into the same stale (still-unresolved) promise.
    (
        channelService as unknown as { _inflightSyncByChannel: Map<string, Promise<void>> }
    )._inflightSyncByChannel.clear();
    await channelService.hydrateFromIDB();
}

describe("channelService.syncChannel", () => {
    beforeEach(async () => {
        await resetService();
    });

    // Global mock cleanup so a failing assertion mid-test doesn't leak
    // a hanging `mockImplementation(() => new Promise(...))` to the
    // next test (which would then deadlock waiting for a `resolveFetch`
    // that never gets called).
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("first sync: no checkpoint → fetchers called with undefined → server_time persisted", async () => {
        const cp = stubCheckpoints();
        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockResolvedValue(envelope("2026-05-29T10:00:00Z", [fakeMessage("m-1", "c-1")]));
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T10:00:01Z"));

        await channelService.syncChannel("c-1");

        expect(msgsSpy).toHaveBeenCalledWith("c-1", undefined);
        expect(threadsSpy).toHaveBeenCalledWith("c-1", undefined);
        expect(cp.setCheckpoint).toHaveBeenCalledWith("v3:msgs:c-1", "2026-05-29T10:00:00Z");
        expect(cp.setCheckpoint).toHaveBeenCalledWith("v3:thrd:c-1", "2026-05-29T10:00:01Z");
        // The fetched message landed in the store.
        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.map((m) => m.id)).toContain("m-1");

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });

    it("second sync: prior checkpoint is read back and passed as since", async () => {
        const cp = stubCheckpoints();
        // Seed the checkpoint repo as though a previous sync had run.
        await cp.setCheckpoint("v3:msgs:c-1", "2026-05-29T10:00:00Z");
        await cp.setCheckpoint("v3:thrd:c-1", "2026-05-29T10:00:01Z");
        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:00Z"));
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:01Z"));

        await channelService.syncChannel("c-1");

        expect(msgsSpy).toHaveBeenCalledWith("c-1", "2026-05-29T10:00:00Z");
        expect(threadsSpy).toHaveBeenCalledWith("c-1", "2026-05-29T10:00:01Z");
        // Checkpoints advanced to the new server_time.
        expect(cp.setCheckpoint).toHaveBeenLastCalledWith("v3:thrd:c-1", "2026-05-29T11:00:01Z");

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });

    it("empty-string checkpoint (from prior force-full eviction) treated as no checkpoint", async () => {
        const cp = stubCheckpoints();
        await cp.setCheckpoint("v3:msgs:c-1", "");
        await cp.setCheckpoint("v3:thrd:c-1", "");
        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockResolvedValue(envelope("2026-05-29T12:00:00Z"));
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T12:00:01Z"));

        await channelService.syncChannel("c-1");

        // No `?since=` arg → REST helper omits the param.
        expect(msgsSpy).toHaveBeenCalledWith("c-1", undefined);
        expect(threadsSpy).toHaveBeenCalledWith("c-1", undefined);

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });

    it("concurrent calls for the same channelId share one in-flight promise", async () => {
        stubCheckpoints();
        let resolveFetch: ((v: DeltaEnvelope<MessagesDeltaData>) => void) | null = null;
        const msgsSpy = vi.spyOn(channelService, "fetchMessagesDelta").mockImplementation(
            () =>
                new Promise<DeltaEnvelope<MessagesDeltaData>>((res) => {
                    resolveFetch = res;
                })
        );
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T10:00:01Z"));

        const a = channelService.syncChannel("c-1");
        const b = channelService.syncChannel("c-1");
        const c = channelService.syncChannel("c-1");

        // The three callers got the same promise back.
        expect(a).toBe(b);
        expect(b).toBe(c);

        // _doSyncChannel awaits checkpoint reads before reaching the
        // fetch call; flush microtasks until the spy has been invoked
        // so `resolveFetch` is assigned.
        await vi.waitFor(() => expect(msgsSpy).toHaveBeenCalled());
        resolveFetch!(envelope("2026-05-29T10:00:00Z"));
        await a;
        // Only one REST hit despite three callers.
        expect(msgsSpy).toHaveBeenCalledTimes(1);
        expect(threadsSpy).toHaveBeenCalledTimes(1);
    });

    it("REST failure leaves the checkpoint unmoved", async () => {
        const cp = stubCheckpoints();
        await cp.setCheckpoint("v3:msgs:c-1", "2026-05-29T10:00:00Z");
        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockRejectedValue(new Error("network"));
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:01Z"));

        await expect(channelService.syncChannel("c-1")).rejects.toThrow();
        // The setCheckpoint after the fetches never ran for `v3:msgs:c-1`.
        // Only the seed (`2026-05-29T10:00:00Z`) is present.
        const remaining = await cp.getCheckpoint("v3:msgs:c-1");
        expect(remaining).toBe("2026-05-29T10:00:00Z");

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });

    it("force_full_reload on top-level evicts top-level messages BEFORE applying payload", async () => {
        const cp = stubCheckpoints();
        await cp.setCheckpoint("v3:msgs:c-1", "2026-05-29T10:00:00Z");
        // Seed: a stale top-level message + a thread reply (which must
        // NOT be evicted because force-full-reload is scoped to top-level).
        channelService.handleMessageCreated(fakeMessage("m-stale", "c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-reply", "c-1", {
                isThreadReply: true,
                threadRootId: "m-stale",
                parentId: "m-stale",
            })
        );

        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockResolvedValue(
                envelope("2026-05-29T11:00:00Z", [fakeMessage("m-fresh", "c-1")], [], true)
            );
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:01Z"));

        await channelService.syncChannel("c-1");

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        // Stale top-level gone, fresh top-level present, reply preserved.
        expect(msgs.find((m) => m.id === "m-stale")).toBeUndefined();
        expect(msgs.find((m) => m.id === "m-fresh")).toBeDefined();
        expect(msgs.find((m) => m.id === "m-reply")).toBeDefined();

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });

    it("data.deletes hard-removes the listed message ids", async () => {
        stubCheckpoints();
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        channelService.handleMessageCreated(fakeMessage("m-2", "c-1"));

        const msgsSpy = vi
            .spyOn(channelService, "fetchMessagesDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:00Z", [], ["m-1"]));
        const threadsSpy = vi
            .spyOn(channelService, "fetchThreadsDelta")
            .mockResolvedValue(envelope("2026-05-29T11:00:01Z"));

        await channelService.syncChannel("c-1");

        const msgs = channelService.getSnapshot().messagesByChannel.get("c-1") ?? [];
        expect(msgs.find((m) => m.id === "m-1")).toBeUndefined();
        expect(msgs.find((m) => m.id === "m-2")).toBeDefined();

        msgsSpy.mockRestore();
        threadsSpy.mockRestore();
    });
});
