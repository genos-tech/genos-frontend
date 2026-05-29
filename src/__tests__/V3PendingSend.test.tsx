/**
 * Pending-send queue tests.
 *
 * Contract (see `PendingMessage` in `channelService.ts`):
 *   - `send()` always enqueues a PendingMessage (status: "queued").
 *   - If the socket is connected, the entry transitions queued → sending
 *     and the ack settles the Promise + removes the entry.
 *   - If the socket is disconnected, the entry stays queued and the
 *     Promise stays pending until `flushPendingQueue()` is called.
 *   - Ack=err transitions the entry to "failed" with `lastError` set.
 *     `retryPending(corr)` re-emits with the SAME correlation id.
 *     `discardPending(corr)` drops without sending and rejects the
 *     Promise with code DISCARDED.
 *   - When a server broadcast lands with a matching `correlation_id`,
 *     the pending entry is removed (catch-up if the ack was dropped).
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService, type PendingMessage } from "../services/channel/channelService";
import { ChannelKind, type Message } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

type SocketAck = { ok: true; data?: unknown } | { ok: false; code: string; message: string };
type SocketEmitFn = (
    event: string,
    payload: Record<string, unknown>,
    ack: (a: SocketAck) => void
) => void;

interface SocketStub {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    setEmitImpl: (impl: SocketEmitFn) => void;
}

function stubSocket(connected = true): SocketStub {
    const emit = vi.fn() as SocketStub["emit"];
    emit.mockImplementation((_event, _payload, ack) => {
        ack({ ok: true });
    });
    const stub: SocketStub = {
        connected,
        emit,
        setEmitImpl: (impl) => emit.mockImplementation(impl),
    };
    (channelService as unknown as { socket: SocketStub }).socket = stub;
    return stub;
}

function detachSocket() {
    (channelService as unknown as { socket: null }).socket = null;
}

function fakeMessage(corr: string, channelId: string, id = "m-1"): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: "u-me",
            userName: "Me",
            userEmail: "me@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: corr,
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
    };
}

async function resetService() {
    // Drain any leftover pending state from prior tests.
    const svc = channelService as unknown as {
        _pendingByCorrelationId: Map<string, PendingMessage>;
        _pendingByChannel: Map<string, PendingMessage[]>;
        _pendingResolvers: Map<string, { resolve: unknown; reject: (e: Error) => void }>;
    };
    // Reject any orphaned resolvers so unhandled-rejection isn't logged
    // when the test framework GC's the dangling Promises.
    for (const r of svc._pendingResolvers.values()) {
        r.reject(new Error("test cleanup"));
    }
    svc._pendingByCorrelationId.clear();
    svc._pendingByChannel.clear();
    svc._pendingResolvers.clear();
    channelService.resetIdbHealth();
}

describe("send() — connected", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("enqueues with status queued, transitions to sending, removes on ack OK", async () => {
        const sock = stubSocket();
        // Capture the corr id from the emit payload + respond with a
        // server-issued Message so the resolver resolves.
        sock.setEmitImpl((event, payload, ack) => {
            if (event !== "message.send") {
                ack({ ok: true });
                return;
            }
            const corr = payload.correlation_id as string;
            const message = fakeMessage(corr, "c-1");
            ack({ ok: true, data: message });
        });

        const promise = channelService.send("c-1", [{ t: "p" }], { bodyText: "hi" });
        // Synchronously, BEFORE the ack microtask runs, the pending
        // entry should be visible — that's the optimistic UI hook.
        const snap = channelService.getSnapshot();
        const pending = snap.pendingByChannel.get("c-1") ?? [];
        expect(pending).toHaveLength(1);
        const result = await promise;
        expect(result.bodyText).toBe(pending[0].correlationId);
        // After ack, the entry is gone.
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });

    it("ack=err transitions to failed + rejects the Promise", async () => {
        const sock = stubSocket();
        sock.setEmitImpl((_event, _payload, ack) => {
            ack({ ok: false, code: "VALIDATION_FAILED", message: "bad body" });
        });

        const promise = channelService.send("c-1", [{ t: "p" }]);
        await expect(promise).rejects.toThrow("bad body");
        const snap = channelService.getSnapshot();
        const pending = snap.pendingByChannel.get("c-1") ?? [];
        // Stays in the queue at status=failed for retry/discard.
        expect(pending).toHaveLength(1);
        expect(pending[0].status).toBe("failed");
        expect(pending[0].lastError?.code).toBe("VALIDATION_FAILED");
    });

    it("a broadcast with the same correlation_id removes the pending entry", async () => {
        const sock = stubSocket();
        // Ack succeeds; the broadcast also lands with the same corr.
        // Both paths converge — the broadcast removal is idempotent
        // against the ack-path removal.
        let capturedCorr: string | null = null;
        sock.setEmitImpl((_event, payload, ack) => {
            capturedCorr = payload.correlation_id as string;
            ack({ ok: true, data: fakeMessage(capturedCorr, "c-1") });
        });
        await channelService.send("c-1", [{ t: "p" }]);
        // After ack, the pending entry is gone.
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
        // Simulate a delayed broadcast for the same corr — should be a
        // no-op (already removed).
        channelService.handleMessageCreated({
            ...fakeMessage(capturedCorr!, "c-1"),
            correlation_id: capturedCorr!,
        } as Message & { correlation_id: string });
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });

    it("a broadcast for a still-pending entry removes it (ack-lost catch-up)", async () => {
        // Simulate: socket is up, but the ack callback never fires
        // (network blip mid-emit). The broadcast arrives later and
        // takes over the resolver.
        const sock = stubSocket();
        sock.setEmitImpl(() => {
            /* deliberately don't call ack — pending entry stays sending */
        });

        const promise = channelService.send("c-1", [{ t: "p" }], { bodyText: "hi" });
        // Yield so the emit-and-no-ack flow runs.
        await new Promise((r) => setTimeout(r, 10));
        const snap = channelService.getSnapshot();
        const pending = snap.pendingByChannel.get("c-1") ?? [];
        expect(pending).toHaveLength(1);
        expect(pending[0].status).toBe("sending");

        // Now the broadcast arrives with the corr id — settles the
        // resolver and removes the pending entry.
        const serverMsg = {
            ...fakeMessage(pending[0].correlationId, "c-1"),
            correlation_id: pending[0].correlationId,
        } as Message & { correlation_id: string };
        channelService.handleMessageCreated(serverMsg);

        const result = await promise;
        expect(result.id).toBe(serverMsg.id);
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });
});

describe("send() — offline queue", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("no socket → entry stays queued + Promise stays pending", async () => {
        detachSocket();
        const promise = channelService.send("c-1", [{ t: "p" }], { bodyText: "hi" });
        // Race the Promise against a short timer — Promise should NOT
        // resolve/reject within the window.
        const settled = await Promise.race([
            promise.then(() => "settled"),
            new Promise<string>((r) => setTimeout(() => r("hanging"), 50)),
        ]);
        expect(settled).toBe("hanging");
        const pending = channelService.getSnapshot().pendingByChannel.get("c-1") ?? [];
        expect(pending).toHaveLength(1);
        expect(pending[0].status).toBe("queued");

        // Clean up the dangling resolver so the test framework doesn't
        // log the abandoned Promise as unhandled.
        channelService.discardPending(pending[0].correlationId);
        await promise.catch(() => undefined);
    });

    it("flushPendingQueue() drains queued entries in enqueuedAt order", async () => {
        detachSocket();
        const p1 = channelService.send("c-1", [{ t: "p" }], { bodyText: "first" });
        // Force a tiny delay so the timestamps differ.
        await new Promise((r) => setTimeout(r, 5));
        const p2 = channelService.send("c-1", [{ t: "p" }], { bodyText: "second" });

        // Reattach a socket that acks every emit; flush should fire both.
        const sock = stubSocket();
        const order: string[] = [];
        sock.setEmitImpl((_event, payload, ack) => {
            order.push(payload.body_text as string);
            ack({ ok: true, data: fakeMessage(payload.correlation_id as string, "c-1") });
        });

        await channelService.flushPendingQueue();
        await Promise.all([p1, p2]);
        expect(order).toEqual(["first", "second"]);
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });
});

describe("retryPending / discardPending", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        detachSocket();
    });

    it("retryPending re-emits a failed entry with the SAME correlation id", async () => {
        const sock = stubSocket();
        // First attempt fails.
        sock.setEmitImpl((_event, _payload, ack) => {
            ack({ ok: false, code: "BACKEND_ERROR", message: "first try" });
        });
        const first = channelService.send("c-1", [{ t: "p" }]);
        await expect(first).rejects.toThrow("first try");
        const failed = channelService.getSnapshot().pendingByChannel.get("c-1") ?? [];
        expect(failed).toHaveLength(1);
        const corr = failed[0].correlationId;

        // Retry with the same corr — second attempt succeeds and uses
        // the same correlation id (verified via the emit spy).
        const emittedCorrs: string[] = [];
        sock.setEmitImpl((_event, payload, ack) => {
            emittedCorrs.push(payload.correlation_id as string);
            ack({ ok: true, data: fakeMessage(corr, "c-1") });
        });
        await channelService.retryPending(corr);
        expect(emittedCorrs).toEqual([corr]);
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });

    it("retryPending rejects when the correlation id isn't pending", async () => {
        await expect(channelService.retryPending("nope")).rejects.toThrow(/No pending/);
    });

    it("discardPending removes the entry + rejects the Promise with DISCARDED", async () => {
        detachSocket();
        const promise = channelService.send("c-1", [{ t: "p" }]);
        const pending = channelService.getSnapshot().pendingByChannel.get("c-1") ?? [];
        expect(pending).toHaveLength(1);
        channelService.discardPending(pending[0].correlationId);
        await expect(promise).rejects.toMatchObject({ code: "DISCARDED" });
        expect(channelService.getSnapshot().pendingByChannel.get("c-1")).toBeUndefined();
    });

    it("pendingByChannel ordering is stable across upserts", async () => {
        detachSocket();
        const p1 = channelService.send("c-1", [{ t: "p" }], { bodyText: "first" });
        await new Promise((r) => setTimeout(r, 5));
        const p2 = channelService.send("c-1", [{ t: "p" }], { bodyText: "second" });
        const pending = channelService.getSnapshot().pendingByChannel.get("c-1") ?? [];
        expect(pending.map((p) => p.bodyText)).toEqual(["first", "second"]);
        // Clean up so the dangling Promises don't log as unhandled.
        for (const p of pending) channelService.discardPending(p.correlationId);
        await Promise.allSettled([p1, p2]);
    });
});
