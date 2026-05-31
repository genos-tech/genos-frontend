/**
 * Pin + Flag socket-emit tests.
 *
 * The pin/flag pipeline is now socket-based (was REST). The contract:
 *   - `pinChannel` / `unpinChannel` / `flagMessage` / `unflagMessage`
 *     emit `pin.add` / `pin.remove` / `flag.add` / `flag.remove` events
 *     on the `/v3` namespace and await an ack.
 *   - Optimistic store update happens immediately; if the ack fails
 *     the optimistic row is rolled back.
 *   - The server broadcasts `pin.added` / `pin.removed` / `flag.added` /
 *     `flag.removed` on the `user:<userId>` room (cross-tab). Inbound
 *     events go through `handlePinAdded` / `handlePinRemoved` /
 *     `handleFlagAdded` / `handleFlagRemoved` — these are also called
 *     for the self-emitted broadcast so the optimistic placeholder
 *     gets swapped for the server-issued row.
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    // Clear pins / flags so a prior test's `handlePinAdded` /
    // `handleFlagAdded` doesn't leak forward and break "this row
    // starts un-flagged" assertions.
    const svc = channelService as unknown as {
        _inflightSyncByChannel: Map<string, Promise<void>>;
        _pins: Map<string, Pin>;
        _flags: Map<string, Flag>;
        _pinByChannelId: Map<string, Pin>;
        _flagByMessageId: Map<string, Flag>;
    };
    svc._inflightSyncByChannel.clear();
    svc._pins.clear();
    svc._flags.clear();
    svc._pinByChannelId.clear();
    svc._flagByMessageId.clear();
    await channelService.hydrateFromIDB();
}

type SocketAck = { ok: true; data?: unknown } | { ok: false; code: string; message: string };
type SocketEmitFn = (
    event: string,
    payload: Record<string, unknown>,
    ack: (a: SocketAck) => void
) => void;

interface SocketStub {
    connected: boolean;
    emit: ReturnType<typeof vi.fn> & { mock: { calls: unknown[][] } };
    setEmitImpl: (impl: SocketEmitFn) => void;
}

/** Replace channelService.socket with a stub that calls the ack
 *  callback synchronously. The default impl returns `{ok: true}` for
 *  every emit — tests that care about specific payloads or want to
 *  simulate the broadcast call `setEmitImpl()`. */
function stubSocket(): SocketStub {
    const emit = vi.fn() as SocketStub["emit"];
    emit.mockImplementation((_event, _payload, ack) => {
        ack({ ok: true });
    });
    const stub = {
        connected: true,
        emit,
        setEmitImpl: (impl: SocketEmitFn) => emit.mockImplementation(impl),
    };
    (channelService as unknown as { socket: SocketStub }).socket = stub;
    return stub;
}

describe("channelService pin (socket)", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("pinChannel: optimistic insert → emit pin.add → server-issued Pin replaces placeholder via broadcast", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const sock = stubSocket();
        const serverPin: Pin = {
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        // Server flow: emit ack carries the row, then a broadcast
        // arrives on the user room (which our own tab also receives).
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "pin.add") {
                ack({ ok: true, data: serverPin });
                // Simulate the broadcast loop — the socket router on a
                // real client would invoke this for us.
                channelService.handlePinAdded(serverPin);
            } else {
                ack({ ok: true });
            }
        });

        const promise = channelService.pinChannel("c-1");
        // Optimistic: visible immediately.
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(true);
        const pin = await promise;
        expect(pin).toEqual(serverPin);
        // Placeholder has been replaced by the server-issued id.
        expect(channelService.getSnapshot().pinByChannelId.get("c-1")?.id).toBe("pin-1");
        expect(sock.emit).toHaveBeenCalledWith(
            "pin.add",
            expect.objectContaining({ channel_id: "c-1" }),
            expect.any(Function)
        );
    });

    it("pinChannel: ack fails → optimistic row rolled back", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const sock = stubSocket();
        sock.setEmitImpl((_event, _payload, ack) => {
            ack({ ok: false, code: "BACKEND_ERROR", message: "boom" });
        });

        await expect(channelService.pinChannel("c-1")).rejects.toThrow("boom");
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(false);
    });

    it("unpinChannel: optimistic remove → emit pin.remove → success clears store", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        // Seed an existing pin via the inbound handler (simulating a
        // prior broadcast).
        channelService.handlePinAdded({
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        });
        const sock = stubSocket();
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "pin.remove") {
                ack({ ok: true });
                channelService.handlePinRemoved("c-1");
            } else {
                ack({ ok: true });
            }
        });

        await channelService.unpinChannel("c-1");
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(false);
        expect(sock.emit).toHaveBeenCalledWith(
            "pin.remove",
            expect.objectContaining({ channel_id: "c-1" }),
            expect.any(Function)
        );
    });

    it("unpinChannel: ack fails → optimistic removal rolled back", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handlePinAdded({
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        });
        const sock = stubSocket();
        sock.setEmitImpl((_event, _payload, ack) => {
            ack({ ok: false, code: "BACKEND_ERROR", message: "network" });
        });

        await expect(channelService.unpinChannel("c-1")).rejects.toThrow();
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(true);
    });

    it("a pin.added broadcast from another tab lands in the store", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const pinFromPeer: Pin = {
            id: "pin-peer",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        channelService.handlePinAdded(pinFromPeer);
        expect(channelService.getSnapshot().pinByChannelId.get("c-1")?.id).toBe("pin-peer");
    });

    it("a pin.removed broadcast from another tab clears the store", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handlePinAdded({
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        });
        channelService.handlePinRemoved("c-1");
        expect(channelService.getSnapshot().pinByChannelId.has("c-1")).toBe(false);
    });
});

describe("channelService flag (socket)", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("flagMessage: optimistic insert → emit flag.add → server-issued Flag replaces placeholder", async () => {
        const sock = stubSocket();
        const serverFlag: Flag = {
            id: "flag-1",
            messageId: "m-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "flag.add") {
                ack({ ok: true, data: serverFlag });
                channelService.handleFlagAdded(serverFlag);
            } else {
                ack({ ok: true });
            }
        });

        const promise = channelService.flagMessage("m-1");
        expect(channelService.getSnapshot().flagByMessageId.has("m-1")).toBe(true);
        await promise;
        expect(channelService.getSnapshot().flagByMessageId.get("m-1")?.id).toBe("flag-1");
    });

    it("unflagMessage: success → store clears", async () => {
        channelService.handleFlagAdded({
            id: "flag-1",
            messageId: "m-1",
            tsCreated: "2026-01-02T00:00:00Z",
        });
        const sock = stubSocket();
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "flag.remove") {
                ack({ ok: true });
                channelService.handleFlagRemoved("m-1");
            } else {
                ack({ ok: true });
            }
        });

        await channelService.unflagMessage("m-1");
        expect(channelService.getSnapshot().flagByMessageId.has("m-1")).toBe(false);
    });

    it("a flag.added broadcast from another tab lands in the store", () => {
        const flagFromPeer: Flag = {
            id: "flag-peer",
            messageId: "m-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        channelService.handleFlagAdded(flagFromPeer);
        expect(channelService.getSnapshot().flagByMessageId.get("m-1")?.id).toBe("flag-peer");
    });
});

describe("useChannelList sorts pinned first", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("pinned channels come before unpinned even when they're older", () => {
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
        // Seed a pin via the inbound handler.
        channelService.handlePinAdded({
            id: "pin-1",
            channelId: "c-old",
            tsCreated: "2026-03-01T00:00:00Z",
        });

        const { result } = renderHook(() => useChannelList());
        expect(result.current.channels.map((c) => c.id)).toEqual(["c-old", "c-new"]);
    });
});

describe("ChannelListV3 pin button", () => {
    beforeEach(async () => {
        await resetService();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("clicking the pin button emits pin.add + reflects the broadcast in the UI", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const sock = stubSocket();
        const serverPin: Pin = {
            id: "pin-1",
            channelId: "c-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "pin.add") {
                ack({ ok: true, data: serverPin });
                channelService.handlePinAdded(serverPin);
            } else {
                ack({ ok: true });
            }
        });

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        const btn = screen.getByTestId("channel-list-v3-pin-c-1");

        expect(screen.queryByTestId("channel-list-v3-pinned-indicator-c-1")).toBeNull();
        fireEvent.click(btn);
        await waitFor(() => {
            expect(sock.emit).toHaveBeenCalledWith(
                "pin.add",
                expect.objectContaining({ channel_id: "c-1" }),
                expect.any(Function)
            );
        });
        await waitFor(() => {
            expect(screen.getByTestId("channel-list-v3-pinned-indicator-c-1")).toBeInTheDocument();
        });
    });

    it("clicking the pin button does not also fire the row onSelect", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        stubSocket();
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
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("clicking the flag button emits flag.add + reflects the broadcast in the UI", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        const sock = stubSocket();
        const serverFlag: Flag = {
            id: "flag-1",
            messageId: "m-1",
            tsCreated: "2026-01-02T00:00:00Z",
        };
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "flag.add") {
                ack({ ok: true, data: serverFlag });
                channelService.handleFlagAdded(serverFlag);
            } else {
                ack({ ok: true });
            }
        });

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-row-flagged-indicator-m-1")).toBeNull();

        fireEvent.click(screen.getByTestId("message-row-flag-m-1"));
        await waitFor(() => {
            expect(sock.emit).toHaveBeenCalledWith(
                "flag.add",
                expect.objectContaining({ message_id: "m-1" }),
                expect.any(Function)
            );
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
        const sock = stubSocket();
        sock.setEmitImpl((event, _payload, ack) => {
            if (event === "flag.add") {
                const flag = {
                    id: "flag-1",
                    messageId: "m-1",
                    tsCreated: "2026-01-02T00:00:00Z",
                };
                ack({ ok: true, data: flag });
                channelService.handleFlagAdded(flag);
            } else {
                ack({ ok: true });
            }
        });
        await act(async () => {
            await channelService.flagMessage("m-1");
        });
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-row-flagged-indicator-m-1")).toBeInTheDocument();
    });
});
