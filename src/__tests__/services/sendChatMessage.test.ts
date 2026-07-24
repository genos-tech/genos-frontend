/**
 * sendChatMessage — success/failure contract.
 *
 * Verifies the v3 send path reports whether the message was accepted (so
 * bnChatEditor can restore the composer on failure) and surfaces a
 * `messageSendFailed` toast when the send is rejected. `channelService` is
 * mocked; the requestErrorNotifier bus is real (we subscribe to capture).
 * `Date.now` is spied so the bus's 4s dedup window stays deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendChatMessage } from "../../features/chat/services/sendChatMessage";
import { channelService } from "../../services/channel/channelService";
import {
    subscribeRequestErrors,
    type RequestErrorKind,
} from "../../services/requestErrorNotifier";

vi.mock("../../services/channel/channelService", () => ({
    channelService: { send: vi.fn() },
}));

let now = 0;
beforeEach(() => {
    vi.clearAllMocks();
    now += 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    // The non-UUID guard and the failure path console.error by design;
    // silence so the test output stays clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

const makeArgs = (chatId: string = VALID_UUID) => ({
    socket: {} as never,
    chat: { chatId, chatType: 2 } as never,
    content: [{ type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] }],
    myself: {
        userId: "user-me",
        userName: "Me",
        userEmail: "m@x",
        avatarImgPath: "",
    } as never,
    useCM: { funcSetAllChats: vi.fn().mockResolvedValue(undefined) } as never,
    setCurrentChat: vi.fn(),
});

const capture = () => {
    const kinds: RequestErrorKind[] = [];
    const unsub = subscribeRequestErrors((k) => kinds.push(k));
    return { kinds, unsub };
};

describe("sendChatMessage", () => {
    it("returns true and sends with an optimistic echo on a successful send", async () => {
        vi.mocked(channelService.send).mockResolvedValue({} as never);
        const { kinds, unsub } = capture();
        const args = makeArgs();

        const ok = await sendChatMessage(args);

        expect(ok).toBe(true);
        // The echo opt-in carries the sender so the pane can paint the
        // bubble immediately; channelService owns the reconcile.
        expect(channelService.send).toHaveBeenCalledWith(
            VALID_UUID,
            args.content,
            expect.objectContaining({
                echo: { sender: expect.objectContaining({ userId: "user-me" }) },
            })
        );
        // No explicit chat-list refresh anymore: the store's latestMessage
        // bump + the channelsVersion-gated sidebar subscription re-sort it.
        expect(args.useCM.funcSetAllChats).not.toHaveBeenCalled();
        expect(kinds).toEqual([]);
        unsub();
    });

    it("returns false and toasts messageSendFailed when the send is rejected", async () => {
        vi.mocked(channelService.send).mockRejectedValue(new Error("Read timed out"));
        const { kinds, unsub } = capture();
        const args = makeArgs();

        const ok = await sendChatMessage(args);

        expect(ok).toBe(false);
        expect(args.useCM.funcSetAllChats).not.toHaveBeenCalled();
        expect(kinds).toEqual(["messageSendFailed"]);
        unsub();
    });

    it("returns false and never emits over the socket for a stale non-v3 chatId", async () => {
        const { kinds, unsub } = capture();
        const args = makeArgs("3"); // legacy integer id, not a UUID

        const ok = await sendChatMessage(args);

        expect(ok).toBe(false);
        expect(channelService.send).not.toHaveBeenCalled();
        expect(kinds).toEqual(["messageSendFailed"]);
        unsub();
    });
});
