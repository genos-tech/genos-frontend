/**
 * Pin + Flag surface tests.
 *
 * Covers:
 *   - `channelService.pinChannel` / `unpinChannel` optimistic flow:
 *     store flips immediately, REST is invoked, server-issued Pin
 *     replaces the optimistic placeholder on success, rollback on
 *     failure.
 *   - `channelService.flagMessage` / `unflagMessage` same semantics.
 *   - `useChannelList` sorts pinned channels first.
 *   - `ChannelListV3` renders the pin button + indicator + toggles.
 *   - `MessagesPaneV3` renders the flag button + indicator + toggles.
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelListV3 } from "../features/channel/components/ChannelListV3";
import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { useChannelList } from "../features/channel/hooks/useChannelList";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Flag, type Message, type Pin } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

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
        bodyText: "msg",
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
    await channelService.hydrateFromIDB();
}

/** Stub the lazily-created v3 axios instance so tests can spy on its
 *  POST/DELETE calls without going through the real `api()` getter. */
function stubAxios(): {
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
} {
    const stub = {
        post: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
    };
    // The accessToken gate inside `api()` would otherwise throw
    // UNAUTHENTICATED — sidestep by patching the lazy axios reference
    // + the gate token directly via the private fields.
    const svc = channelService as unknown as {
        accessToken: string | null;
        _axios: unknown;
        _axiosToken: string | null;
    };
    svc.accessToken = "test-token";
    svc._axios = stub;
    svc._axiosToken = "test-token";
    return stub;
}

describe("channelService pin", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("pinChannel updates the store optimistically and replaces with server Pin on success", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        const serverPin: Pin = {
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        stub.post.mockResolvedValueOnce({ data: serverPin });

        const promise = channelService.pinChannel("c-1");
        // Optimistic — visible immediately.
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(true);
        const pin = await promise;
        expect(pin).toEqual(serverPin);
        expect(channelService.getSnapshot().pinByChannelId.get("c-1")?.id).toBe("pin-1");
        expect(stub.post).toHaveBeenCalledWith("/api/v3/channels/c-1/pin/");
    });

    it("pinChannel rolls back on REST failure", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        stub.post.mockRejectedValueOnce(new Error("network"));

        await expect(channelService.pinChannel("c-1")).rejects.toThrow();
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(false);
    });

    it("unpinChannel removes optimistically and restores on failure", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        // First seed an existing pin.
        stub.post.mockResolvedValueOnce({
            data: { id: "pin-1", channelId: "c-1", tsCreated: "2026-01-02T00:00:00Z" },
        });
        await channelService.pinChannel("c-1");
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(true);

        // Now make unpin fail — the pin should come back.
        stub.delete.mockRejectedValueOnce(new Error("network"));
        await expect(channelService.unpinChannel("c-1")).rejects.toThrow();
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(true);
    });

    it("unpinChannel succeeds → store clears", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "pin-1", channelId: "c-1", tsCreated: "2026-01-02T00:00:00Z" },
        });
        await channelService.pinChannel("c-1");

        stub.delete.mockResolvedValueOnce({});
        await channelService.unpinChannel("c-1");
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(false);
    });
});

describe("channelService flag", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("flagMessage updates the store optimistically and replaces with server Flag on success", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        const serverFlag: Flag = {
            id: "flag-1",
            messageId: "m-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        stub.post.mockResolvedValueOnce({ data: serverFlag });

        const promise = channelService.flagMessage("m-1");
        expect(channelService.getSnapshot().flagByMessageId.has("m-1")).toBe(true);
        await promise;
        expect(channelService.getSnapshot().flagByMessageId.get("m-1")?.id).toBe("flag-1");
        expect(stub.post).toHaveBeenCalledWith("/api/v3/messages/m-1/flag/");
    });

    it("unflagMessage succeeds → store clears", async () => {
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "flag-1", messageId: "m-1", tsCreated: "2026-01-02T00:00:00Z" },
        });
        await channelService.flagMessage("m-1");
        expect(channelService.getSnapshot().flagByMessageId.has("m-1")).toBe(true);

        stub.delete.mockResolvedValueOnce({});
        await channelService.unflagMessage("m-1");
        expect(channelService.getSnapshot().flagByMessageId.has("m-1")).toBe(false);
    });
});

describe("useChannelList sorts pinned first", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("pinned channels come before unpinned even when they're older", async () => {
        // c-old (pinned) is older than c-new (unpinned). Without the
        // pin-first sort, c-new would lead.
        channelService.handleChannelCreated(
            fakeChannel("c-old", {
                tsUpdated: "2026-01-01T00:00:00Z",
                tsCreated: "2026-01-01T00:00:00Z",
            })
        );
        channelService.handleChannelCreated(
            fakeChannel("c-new", {
                tsUpdated: "2026-02-01T00:00:00Z",
                tsCreated: "2026-02-01T00:00:00Z",
            })
        );
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "pin-1", channelId: "c-old", tsCreated: "2026-03-01T00:00:00Z" },
        });
        await channelService.pinChannel("c-old");

        const { result } = renderHook(() => useChannelList());
        expect(result.current.channels.map((c) => c.id)).toEqual(["c-old", "c-new"]);
    });
});

describe("ChannelListV3 pin button", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("clicking the pin button toggles the channel's pinned state", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "pin-1", channelId: "c-1", tsCreated: "2026-01-02T00:00:00Z" },
        });

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        const btn = screen.getByTestId("channel-list-v3-pin-c-1");

        expect(screen.queryByTestId("channel-list-v3-pinned-indicator-c-1")).toBeNull();
        fireEvent.click(btn);
        await waitFor(() => {
            expect(stub.post).toHaveBeenCalledWith("/api/v3/channels/c-1/pin/");
        });
        await waitFor(() => {
            expect(screen.getByTestId("channel-list-v3-pinned-indicator-c-1")).toBeInTheDocument();
        });
    });

    it("clicking the pin button does not also fire the row onSelect", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        stubAxios();
        const onSelect = vi.fn();
        render(<ChannelListV3 selectedChannelId={null} onSelect={onSelect} />);
        fireEvent.click(screen.getByTestId("channel-list-v3-pin-c-1"));
        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe("MessagesPaneV3 flag button", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("clicking the flag button toggles the message's flagged state", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "flag-1", messageId: "m-1", tsCreated: "2026-01-02T00:00:00Z" },
        });

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-row-flagged-indicator-m-1")).toBeNull();

        fireEvent.click(screen.getByTestId("message-row-flag-m-1"));
        await waitFor(() => {
            expect(stub.post).toHaveBeenCalledWith("/api/v3/messages/m-1/flag/");
        });
        await waitFor(() => {
            expect(screen.getByTestId("message-row-flagged-indicator-m-1")).toBeInTheDocument();
        });
    });

    it("flag button is suppressed on deleted rows", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-gone", "c-1", { deletedAt: "2026-01-02T00:00:00Z" })
        );
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-row-flag-m-gone")).toBeNull();
    });

    it("flag button reflects the existing flagged state across re-renders", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        const stub = stubAxios();
        stub.post.mockResolvedValueOnce({
            data: { id: "flag-1", messageId: "m-1", tsCreated: "2026-01-02T00:00:00Z" },
        });
        await act(async () => {
            await channelService.flagMessage("m-1");
        });
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-row-flagged-indicator-m-1")).toBeInTheDocument();
    });
});
