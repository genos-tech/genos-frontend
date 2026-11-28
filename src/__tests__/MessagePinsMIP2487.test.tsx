/**
 * Messages pinned in a chat for everyone (MIP-2487): what the service holds, how it loads the
 * history a jump needs, and the "Messages / Pinned" tabs of a chat pane.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { PinnedMessagesFrame } from "../features/chat/components/shared/PinnedMessagesFrame";
import { pinnedExcerpt } from "../features/chat/utils/messagePins";
import { ChannelService, channelService } from "../services/channel/channelService";
import type { Message, MessagePin } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const CHANNEL = "11111111-1111-4111-8111-111111111111";

const message = (id: string, minute: number, over: Partial<Message> = {}): Message =>
    ({
        attachments: [],
        body: [],
        bodyText: `text ${id}`,
        channelId: CHANNEL,
        deletedAt: null,
        displayId: null,
        id,
        isThreadReply: false,
        mentions: [],
        metadata: {},
        reactions: [],
        sender: { userId: "u-2", userName: "Aiko" },
        tsSent: `2026-11-20T10:${String(minute).padStart(2, "0")}:00Z`,
        ...over,
    }) as unknown as Message;

const pin = (m: Message): MessagePin => ({
    channelId: CHANNEL,
    id: `pin-${m.id}`,
    message: m,
    messageId: m.id,
    pinnedBy: { userId: "u-1", username: "Ken" },
    tsCreated: m.tsSent,
});

const answer = (...pins: MessagePin[]) => ({ hiddenCount: 0, limit: 50, pins });

const stubGet = (service: ChannelService, get: ReturnType<typeof vi.fn>) => {
    service.setCurrentUserId("user-me");
    service.setAccessToken("tok-1");
    vi.spyOn(axios, "create").mockReturnValue({ get } as never);
};

const held = (service: ChannelService) => service.getSnapshot().messagePinsByChannel.get(CHANNEL);
const ids = (service: ChannelService) =>
    (service.getSnapshot().messagesByChannel.get(CHANNEL) ?? []).map((m) => m.id);

describe("the pinned list the service holds", () => {
    it("holds nothing against a server without the feature", async () => {
        const service = new ChannelService();
        stubGet(service, vi.fn().mockRejectedValue(new Error("404")));
        await service.fetchMessagePins(CHANNEL);
        expect(held(service)).toBeUndefined();
    });

    it("re-reads on an event only for a chat it was asked about", async () => {
        const service = new ChannelService();
        const get = vi.fn().mockResolvedValue({ data: answer() });
        stubGet(service, get);
        service.handleMessagePinChanged(CHANNEL);
        expect(get).not.toHaveBeenCalled();
        await service.fetchMessagePins(CHANNEL);
        service.handleMessagePinChanged(CHANNEL);
        service.refreshMessagePins();
        expect(get).toHaveBeenCalledTimes(3);
    });

    it("drops the pin of a deleted message at once", async () => {
        const service = new ChannelService();
        stubGet(
            service,
            vi.fn().mockResolvedValue({
                data: answer(pin(message("a", 1)), pin(message("b", 2)), pin(message("c", 3))),
            })
        );
        await service.fetchMessagePins(CHANNEL);
        service.handleMessageDeleted({ channelId: CHANNEL, id: "a" } as never);
        service.handleMessagesDeleted({ channelId: CHANNEL, messageIds: ["b"] } as never);
        expect(held(service)?.pins.map((p) => p.messageId)).toEqual(["c"]);
    });
});

describe("the history a jump needs", () => {
    it("pages back from the newest held message until the target is in", async () => {
        const service = new ChannelService();
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: { hasMore: true, messages: [message("c", 3), message("d", 4)] },
            })
            .mockResolvedValueOnce({
                data: { hasMore: true, messages: [message("a", 1), message("b", 2)] },
            });
        stubGet(service, get);
        service.handleMessageUpdated(message("e", 5));

        expect(await service.loadMessagesBackTo(CHANNEL, "a")).toBe(true);

        expect(ids(service)).toEqual(["a", "b", "c", "d", "e"]);
        expect(get.mock.calls.map((call) => call[1].params.before)).toEqual(["e", "c"]);
    });

    it("asks for nothing when the message is already held", async () => {
        const service = new ChannelService();
        const get = vi.fn();
        stubGet(service, get);
        service.handleMessageUpdated(message("a", 1));
        expect(await service.loadMessagesBackTo(CHANNEL, "a")).toBe(true);
        expect(get).not.toHaveBeenCalled();
    });

    it("falls back to the message alone, and says when it cannot be read", async () => {
        const service = new ChannelService();
        stubGet(service, vi.fn().mockRejectedValue(new Error("down")));
        service.handleMessageUpdated(message("e", 5));
        const one = vi.spyOn(service, "fetchMessageById").mockResolvedValue(null);
        expect(await service.loadMessagesBackTo(CHANNEL, "a")).toBe(false);
        expect(one).toHaveBeenCalledWith("a");
    });
});

describe("an excerpt", () => {
    it("names a project card's task and labels a text-less message", () => {
        expect(pinnedExcerpt(message("a", 1, { displayId: "APP-3" }))).toBe("APP-3 · text a");
        const gif = message("b", 2, {
            body: [{ props: { url: "https://x/y.gif" }, type: "image" }],
            bodyText: "",
        });
        expect(pinnedExcerpt(gif)).toBe("GIF");
    });
});

describe("the chat's Pinned tab", () => {
    const chat = { chatId: CHANNEL, chatType: 2 } as never;
    const seen = vi.fn();

    const renderFrame = async (pins: MessagePin[], setCurrentChat = vi.fn()) => {
        vi.spyOn(channelService, "fetchMessagePins").mockResolvedValue();
        vi.spyOn(channelService, "loadMessagesBackTo").mockResolvedValue(true);
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({
            messagePinsByChannel: new Map([[CHANNEL, STATE(pins)]]),
        } as never);
        render(
            <CssVarsProvider>
                <PinnedMessagesFrame
                    chat={chat}
                    setCurrentChat={setCurrentChat}
                    onMessageSeenIndex={seen}
                >
                    {(report) => <div onClick={() => report(7)}>messages</div>}
                </PinnedMessagesFrame>
            </CssVarsProvider>
        );
        return setCurrentChat;
    };
    // One object per list: `useSyncExternalStore` needs a stable value.
    const states = new Map<MessagePin[], ReturnType<typeof answer>>();
    const STATE = (pins: MessagePin[]) => {
        if (!states.has(pins)) states.set(pins, answer(...pins));
        return states.get(pins)!;
    };

    it("is not there while nothing is pinned", async () => {
        await renderFrame([]);
        expect(screen.queryByRole("tab")).toBeNull();
        expect(screen.getByText("messages")).toBeTruthy();
    });

    it("lists the pins and jumps to one, again on a second click", async () => {
        const setCurrentChat = await renderFrame([pin(message("a", 1))]);

        fireEvent.click(screen.getByRole("tab", { name: /Pinned/ }));
        expect(screen.getByText("text a")).toBeTruthy();
        expect(screen.getByText("Pinned by Ken")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /text a/ }));

        await waitFor(() => expect(setCurrentChat).toHaveBeenCalledTimes(1));
        // An updater over the chat as it is by then, so just-loaded rows survive.
        const update = setCurrentChat.mock.calls[0][0];
        expect(update({ chatId: CHANNEL, messages: ["older"] })).toEqual({
            chatId: CHANNEL,
            jumpNonce: expect.any(Number),
            messages: ["older"],
            moveToSpecificIndex: "a",
        });
        const other = { chatId: "other" };
        expect(update(other)).toBe(other);
        // Back on the messages.
        expect(screen.getByRole("tab", { name: /Messages/ }).getAttribute("aria-selected")).toBe(
            "true"
        );
    });

    it("reports a row seen under the tab only on the way back", async () => {
        await renderFrame([pin(message("a", 1))]);
        fireEvent.click(screen.getByRole("tab", { name: /Pinned/ }));
        fireEvent.click(screen.getByText("messages"));
        expect(seen).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("tab", { name: /Messages/ }));
        expect(seen).toHaveBeenCalledWith(7);
    });
});
