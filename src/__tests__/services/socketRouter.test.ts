// @vitest-environment jsdom
//
// Tests for the /v3 socket router (src/services/channel/socketRouter.ts).
// Verifies that every server-emitted event name routes to the correct
// channelService method with the right payload, that the few events which
// unwrap a nested field forward only that field, that the live-notification
// CustomEvent fires for message.created, that conditional branches behave,
// and that the returned teardown unregisters every handler.

import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleV3Activity } from "../../features/chat/services/handleV3Activity";
import { channelService } from "../../services/channel/channelService";
import { registerSocketRouter, V3_NAMESPACE } from "../../services/channel/socketRouter";
import { ChannelKind } from "../../types/channel";
import { fakeChannel, fakeMessage, fakeReaction } from "../helpers/factories";

// handleV3Activity is an imported binding (can't spyOn it on the module
// object after import), so mock the module to assert activity.created
// forwards its payload.
vi.mock("../../features/chat/services/handleV3Activity", () => ({
    handleV3Activity: vi.fn(),
}));

/**
 * Minimal fake Socket that records every `on(event, fn)` registration so a
 * test can fire any captured handler, and counts `off(event, fn)` calls so a
 * test can assert teardown unregisters everything.
 */
function makeFakeSocket() {
    const handlers = new Map<string, (data: unknown) => void>();
    const offCalls: Array<{ event: string; fn: (data: unknown) => void }> = [];
    const socket = {
        on: vi.fn((event: string, fn: (data: unknown) => void) => {
            handlers.set(event, fn);
            return socket;
        }),
        off: vi.fn((event: string, fn: (data: unknown) => void) => {
            offCalls.push({ event, fn });
            return socket;
        }),
        emit: vi.fn(),
        connected: true,
    };
    /** Fire a captured handler as if the server emitted `event`. */
    function fire(event: string, data?: unknown) {
        const fn = handlers.get(event);
        if (!fn) throw new Error(`no handler registered for "${event}"`);
        fn(data);
    }
    return { socket: socket as unknown as Socket, handlers, offCalls, fire };
}

describe("registerSocketRouter", () => {
    let env: ReturnType<typeof makeFakeSocket>;
    let teardown: () => void;

    beforeEach(() => {
        // Silence the diagnostic console output the router emits for
        // activity.created / resync.error so the test log stays clean.
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});

        // Spy every channelService method the router touches. mockImplementation
        // / mockResolvedValue prevents the real IDB / network / _notify side
        // effects from running.
        vi.spyOn(channelService, "handleMessageCreated").mockImplementation(() => {});
        vi.spyOn(channelService, "handleMessageUpdated").mockImplementation(() => {});
        vi.spyOn(channelService, "handleReplyCountChanged").mockImplementation(() => {});
        vi.spyOn(channelService, "handleMessageDeleted").mockImplementation(() => {});
        vi.spyOn(channelService, "handleReactionAdded").mockImplementation(() => {});
        vi.spyOn(channelService, "handleReactionRemoved").mockImplementation(() => {});
        vi.spyOn(channelService, "handleReadAdvanced").mockImplementation(() => {});
        vi.spyOn(channelService, "handleChannelCreated").mockImplementation(() => {});
        vi.spyOn(channelService, "handleChannelUpdated").mockImplementation(() => {});
        vi.spyOn(channelService, "handleChannelMemberAdded").mockImplementation(() => {});
        vi.spyOn(channelService, "handleChannelMemberRemoved").mockImplementation(() => {});
        vi.spyOn(channelService, "handlePinAdded").mockImplementation(() => {});
        vi.spyOn(channelService, "handlePinRemoved").mockImplementation(() => {});
        vi.spyOn(channelService, "handleFlagAdded").mockImplementation(() => {});
        vi.spyOn(channelService, "handleFlagRemoved").mockImplementation(() => {});
        vi.spyOn(channelService, "applyResyncBatch").mockResolvedValue(0);
        vi.spyOn(channelService, "syncChannel").mockResolvedValue(undefined);

        env = makeFakeSocket();
        teardown = registerSocketRouter(env.socket);
    });

    afterEach(() => {
        // The channelService singleton persists across tests; restore so the
        // spies don't leak into other test files / cases.
        vi.restoreAllMocks();
    });

    it("exports the /v3 namespace constant", () => {
        expect(V3_NAMESPACE).toBe("/v3");
    });

    it("registers exactly one handler per server event (18 events)", () => {
        const expected = [
            "message.created",
            "message.updated",
            "message.reply_count_changed",
            "message.deleted",
            "reaction.added",
            "reaction.removed",
            "read.advanced",
            "channel.created",
            "channel.updated",
            "channel.member_added",
            "channel.member_removed",
            "resync.batch",
            "pin.added",
            "pin.removed",
            "flag.added",
            "flag.removed",
            "activity.created",
            "resync.error",
        ];
        expect([...env.handlers.keys()].sort()).toEqual([...expected].sort());
        expect(env.socket.on).toHaveBeenCalledTimes(expected.length);
        expect(expected).toHaveLength(18);
    });

    // ---- message.* --------------------------------------------------------

    it("message.created routes to handleMessageCreated AND dispatches v3:message:created", () => {
        const msg = fakeMessage("m1", "c1");
        const received: unknown[] = [];
        const listener = (e: Event) => received.push((e as CustomEvent).detail);
        window.addEventListener("v3:message:created", listener);

        env.fire("message.created", msg);

        expect(channelService.handleMessageCreated).toHaveBeenCalledTimes(1);
        expect(channelService.handleMessageCreated).toHaveBeenCalledWith(msg);
        // Live-notification fan-out: detail.message is the same message.
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ message: msg });
        expect((received[0] as { message: unknown }).message).toBe(msg);

        window.removeEventListener("v3:message:created", listener);
    });

    it("message.updated routes to handleMessageUpdated", () => {
        const msg = fakeMessage("m2", "c1", { bodyText: "edited" });
        env.fire("message.updated", msg);
        expect(channelService.handleMessageUpdated).toHaveBeenCalledTimes(1);
        expect(channelService.handleMessageUpdated).toHaveBeenCalledWith(msg);
        // The body-edit path must NOT touch the reply-count-only handler.
        expect(channelService.handleReplyCountChanged).not.toHaveBeenCalled();
    });

    it("message.reply_count_changed routes to handleReplyCountChanged with the delta", () => {
        const e = { id: "m3", channelId: "c1", channelKind: ChannelKind.GM, replyCount: 4 };
        env.fire("message.reply_count_changed", e);
        expect(channelService.handleReplyCountChanged).toHaveBeenCalledTimes(1);
        expect(channelService.handleReplyCountChanged).toHaveBeenCalledWith(e);
    });

    it("message.deleted routes to handleMessageDeleted with the tombstone event", () => {
        const e = { id: "m4", channelId: "c1", channelKind: ChannelKind.DM };
        env.fire("message.deleted", e);
        expect(channelService.handleMessageDeleted).toHaveBeenCalledTimes(1);
        expect(channelService.handleMessageDeleted).toHaveBeenCalledWith(e);
    });

    // ---- reaction.* -------------------------------------------------------

    it("reaction.added routes to handleReactionAdded with the full event", () => {
        const e = {
            messageId: "m1",
            channelId: "c1",
            channelKind: ChannelKind.GM,
            reaction: fakeReaction("r1"),
        };
        env.fire("reaction.added", e);
        expect(channelService.handleReactionAdded).toHaveBeenCalledTimes(1);
        expect(channelService.handleReactionAdded).toHaveBeenCalledWith(e);
    });

    it("reaction.removed routes to handleReactionRemoved with the full event", () => {
        const e = {
            messageId: "m1",
            channelId: "c1",
            channelKind: ChannelKind.GM,
            userId: "u-alice",
            emoji: "👍",
        };
        env.fire("reaction.removed", e);
        expect(channelService.handleReactionRemoved).toHaveBeenCalledTimes(1);
        expect(channelService.handleReactionRemoved).toHaveBeenCalledWith(e);
    });

    // ---- read.advanced ----------------------------------------------------

    it("read.advanced routes to handleReadAdvanced with the cursor", () => {
        const cursor = {
            channelId: "c1",
            lastReadMessageId: "m9",
            lastReadSeq: 9,
            unreadCount: 0,
        };
        env.fire("read.advanced", cursor);
        expect(channelService.handleReadAdvanced).toHaveBeenCalledTimes(1);
        expect(channelService.handleReadAdvanced).toHaveBeenCalledWith(cursor);
    });

    // ---- channel.* --------------------------------------------------------

    it("channel.created routes to handleChannelCreated with the channel", () => {
        const ch = fakeChannel("c2");
        env.fire("channel.created", ch);
        expect(channelService.handleChannelCreated).toHaveBeenCalledTimes(1);
        expect(channelService.handleChannelCreated).toHaveBeenCalledWith(ch);
    });

    it("channel.updated routes to handleChannelUpdated with the channel", () => {
        const ch = fakeChannel("c2", { title: "renamed" });
        env.fire("channel.updated", ch);
        expect(channelService.handleChannelUpdated).toHaveBeenCalledTimes(1);
        expect(channelService.handleChannelUpdated).toHaveBeenCalledWith(ch);
    });

    it("channel.member_added routes to handleChannelMemberAdded with the full event", () => {
        const e = {
            channelId: "c1",
            channelKind: ChannelKind.GM,
            member: { id: "mem1", userId: "u-bob", role: "member" },
        };
        env.fire("channel.member_added", e);
        expect(channelService.handleChannelMemberAdded).toHaveBeenCalledTimes(1);
        expect(channelService.handleChannelMemberAdded).toHaveBeenCalledWith(e);
    });

    it("channel.member_removed routes to handleChannelMemberRemoved with the full event", () => {
        const e = { channelId: "c1", channelKind: ChannelKind.GM, userId: "u-bob" };
        env.fire("channel.member_removed", e);
        expect(channelService.handleChannelMemberRemoved).toHaveBeenCalledTimes(1);
        expect(channelService.handleChannelMemberRemoved).toHaveBeenCalledWith(e);
    });

    // ---- resync.batch -----------------------------------------------------

    it("resync.batch forwards the single-channel push shape to applyResyncBatch", () => {
        const batch = {
            channel_id: "c1",
            envelope: {
                force_full_reload: false,
                server_time: "2026-01-01T00:00:00Z",
                data: { messages: [fakeMessage("m1", "c1")], deletes: [] },
            },
        };
        env.fire("resync.batch", batch);
        expect(channelService.applyResyncBatch).toHaveBeenCalledTimes(1);
        expect(channelService.applyResyncBatch).toHaveBeenCalledWith(batch);
    });

    // ---- pin.* / flag.* (these UNWRAP a nested field) ---------------------

    it("pin.added unwraps e.pin and routes to handlePinAdded", () => {
        const pin = { id: "p1", channelId: "c1", userId: "u-alice" };
        env.fire("pin.added", { pin });
        expect(channelService.handlePinAdded).toHaveBeenCalledTimes(1);
        // Forwards e.pin, NOT the whole envelope.
        expect(channelService.handlePinAdded).toHaveBeenCalledWith(pin);
    });

    it("pin.removed unwraps e.channelId and routes to handlePinRemoved", () => {
        env.fire("pin.removed", { channelId: "c1" });
        expect(channelService.handlePinRemoved).toHaveBeenCalledTimes(1);
        expect(channelService.handlePinRemoved).toHaveBeenCalledWith("c1");
    });

    it("flag.added unwraps e.flag and routes to handleFlagAdded", () => {
        const flag = { id: "f1", messageId: "m1", userId: "u-alice" };
        env.fire("flag.added", { flag });
        expect(channelService.handleFlagAdded).toHaveBeenCalledTimes(1);
        expect(channelService.handleFlagAdded).toHaveBeenCalledWith(flag);
    });

    it("flag.removed unwraps e.messageId and routes to handleFlagRemoved", () => {
        env.fire("flag.removed", { messageId: "m1" });
        expect(channelService.handleFlagRemoved).toHaveBeenCalledTimes(1);
        expect(channelService.handleFlagRemoved).toHaveBeenCalledWith("m1");
    });

    // ---- activity.created -------------------------------------------------

    it("activity.created forwards the raw payload to handleV3Activity", () => {
        const activity = { kind: "mention", channel_id: "c1", message_id: "m1" };
        env.fire("activity.created", activity);
        expect(handleV3Activity).toHaveBeenCalledTimes(1);
        expect(handleV3Activity).toHaveBeenCalledWith(activity);
    });

    // ---- resync.error (conditional branch) --------------------------------

    it("resync.error with a channel_id falls back to syncChannel(channel_id)", () => {
        env.fire("resync.error", { channel_id: "c7", error: "replay failed" });
        expect(channelService.syncChannel).toHaveBeenCalledTimes(1);
        expect(channelService.syncChannel).toHaveBeenCalledWith("c7");
    });

    it("resync.error WITHOUT a channel_id does NOT call syncChannel", () => {
        env.fire("resync.error", { error: "replay failed" });
        expect(channelService.syncChannel).not.toHaveBeenCalled();
    });

    it("resync.error with undefined payload does NOT throw and does NOT call syncChannel", () => {
        expect(() => env.fire("resync.error", undefined)).not.toThrow();
        expect(channelService.syncChannel).not.toHaveBeenCalled();
    });

    // ---- teardown ---------------------------------------------------------

    it("teardown unregisters every handler via socket.off", () => {
        const registeredEvents = [...env.handlers.keys()];
        teardown();

        // One off() per registered on().
        expect(env.socket.off).toHaveBeenCalledTimes(registeredEvents.length);

        // Each registered event was unregistered with the SAME fn reference
        // that was registered (so socket.io can actually remove it).
        const offByEvent = new Map(env.offCalls.map((c) => [c.event, c.fn]));
        for (const event of registeredEvents) {
            expect(offByEvent.has(event)).toBe(true);
            expect(offByEvent.get(event)).toBe(env.handlers.get(event));
        }
    });

    it("a second registerSocketRouter call is independent: its teardown removes only its own 18 handlers", () => {
        // Sanity: registering twice produces independent handler sets; the
        // second registration's teardown only removes its own handlers.
        const env2 = makeFakeSocket();
        const teardown2 = registerSocketRouter(env2.socket);
        expect(env2.socket.on).toHaveBeenCalledTimes(18);
        teardown2();
        expect(env2.socket.off).toHaveBeenCalledTimes(18);
    });
});
