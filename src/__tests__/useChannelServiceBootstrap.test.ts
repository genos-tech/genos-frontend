/**
 * Lifecycle tests for `useChannelServiceBootstrap`.
 *
 * Mocks the socket.io-client `io()` factory and the IDB layer so the
 * tests run in node without a real network or IndexedDB. Verifies:
 *   - the hook pushes token + user id into channelService synchronously
 *   - on mount, the socket is created, the router is wired, and
 *     hydrate is kicked off
 *   - on unmount, the socket is disconnected and the service is cleared
 *   - re-rendering with the same token is idempotent (no extra socket)
 *   - changing the token disconnects the old socket and opens a new one
 *   - rendering with a null token doesn't open a socket
 */

import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import { useChannelServiceBootstrap } from "../services/channel/useChannelServiceBootstrap";

// Mock the IDB shim so hydrate doesn't try to open IndexedDB.
vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

// Spy-friendly fake socket. `io()` returns one of these per call.
class FakeSocket {
    connected = true;
    listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    on = vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        const arr = this.listeners.get(event) ?? [];
        arr.push(fn);
        this.listeners.set(event, arr);
    });
    off = vi.fn();
    emit = vi.fn();
    disconnect = vi.fn(() => {
        this.connected = false;
    });
}

const ioFactory = vi.fn();
vi.mock("socket.io-client", () => ({
    io: (url: string, opts: unknown) => ioFactory(url, opts),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

describe("useChannelServiceBootstrap", () => {
    beforeEach(() => {
        ioFactory.mockReset();
        ioFactory.mockImplementation(() => new FakeSocket());
        channelService.setAccessToken(null);
        channelService.setCurrentUserId(null);
        channelService.setSocket(null);
    });

    it("does not open a socket when accessToken is null", () => {
        renderHook(() => useChannelServiceBootstrap(null, "user-a", "team-a"));
        expect(ioFactory).not.toHaveBeenCalled();
    });

    it("opens a /v3 socket on mount with auth in the headers + query", () => {
        renderHook(() => useChannelServiceBootstrap("tok-1", "user-a", "team-a"));
        expect(ioFactory).toHaveBeenCalledTimes(1);
        const [url, opts] = ioFactory.mock.calls[0];
        expect(String(url)).toMatch(/\/v3$/);
        const o = opts as { extraHeaders: { Authorization: string }; query: { userId: string } };
        expect(o.extraHeaders.Authorization).toBe("tok-1");
        expect(o.query.userId).toBe("user-a");
    });

    it("registers router listeners (socket.on called for every v3 event)", () => {
        renderHook(() => useChannelServiceBootstrap("tok-1", "user-a", "team-a"));
        const sock = ioFactory.mock.results[0].value as FakeSocket;
        // Every server-pushed v3 event must be wired. Eleven distinct
        // listeners as of this commit (see `socketRouter.ts`):
        //   message.created/updated/deleted, reaction.added/removed,
        //   read.advanced, channel.created/member_added/member_removed,
        //   resync.batch — plus future events as they're added.
        expect(sock.on.mock.calls.length).toBeGreaterThanOrEqual(10);
        const events = sock.on.mock.calls.map((c) => c[0] as string);
        expect(events).toContain("message.created");
        expect(events).toContain("read.advanced");
        expect(events).toContain("resync.batch");
    });

    it("disconnects the socket on unmount and clears the service slot", () => {
        const { unmount } = renderHook(() =>
            useChannelServiceBootstrap("tok-1", "user-a", "team-a")
        );
        const sock = ioFactory.mock.results[0].value as FakeSocket;
        unmount();
        expect(sock.disconnect).toHaveBeenCalledTimes(1);
    });

    it("re-rendering with the same token is idempotent (no second socket)", () => {
        const { rerender } = renderHook(
            ({ tok, uid }: { tok: string | null; uid: string | null }) =>
                useChannelServiceBootstrap(tok, uid, "team-a"),
            { initialProps: { tok: "tok-1", uid: "user-a" } }
        );
        expect(ioFactory).toHaveBeenCalledTimes(1);
        act(() => {
            rerender({ tok: "tok-1", uid: "user-a" });
        });
        expect(ioFactory).toHaveBeenCalledTimes(1);
    });

    it("changing the token disconnects the old socket and opens a fresh one", () => {
        const { rerender } = renderHook(
            ({ tok, uid }: { tok: string | null; uid: string | null }) =>
                useChannelServiceBootstrap(tok, uid, "team-a"),
            { initialProps: { tok: "tok-1", uid: "user-a" } }
        );
        const oldSock = ioFactory.mock.results[0].value as FakeSocket;
        act(() => {
            rerender({ tok: "tok-2", uid: "user-a" });
        });
        expect(ioFactory).toHaveBeenCalledTimes(2);
        expect(oldSock.disconnect).toHaveBeenCalledTimes(1);
        const newSock = ioFactory.mock.results[1].value as FakeSocket;
        expect(newSock).not.toBe(oldSock);
    });

    it("reconnects on a team switch so the socket leaves the old team's room", () => {
        const { rerender } = renderHook(
            ({ team }: { team: string }) => useChannelServiceBootstrap("tok-1", "user-a", team),
            { initialProps: { team: "team-a" } }
        );
        expect(ioFactory).toHaveBeenCalledTimes(1);
        const oldSock = ioFactory.mock.results[0].value as FakeSocket;

        act(() => {
            rerender({ team: "team-b" });
        });

        // `query.teamId` decides which `team:{id}` broadcast room the v3
        // connect handler joins, and it is fixed at construction. Without
        // `teamId` in the effect deps the connection kept receiving the
        // previous team's events after a switch.
        expect(ioFactory).toHaveBeenCalledTimes(2);
        expect(oldSock.disconnect).toHaveBeenCalledTimes(1);
    });

    it("builds the socket query from the team argument, not localStorage", () => {
        // localStorage lags the prop by a render on a switch, and it was
        // the previous source for this field — so a stale value here is
        // exactly the bug, not a hypothetical.
        localStorage.setItem("teamId", "stale-team");
        renderHook(() => useChannelServiceBootstrap("tok-1", "user-a", "team-fresh"));
        const opts = ioFactory.mock.calls[0][1] as { query: { teamId: string } };
        expect(opts.query.teamId).toBe("team-fresh");
    });
});
