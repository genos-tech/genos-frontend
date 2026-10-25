/**
 * The socket URL carries ids and nothing a person typed (MIP-732).
 *
 * `userName`, `userEmail` and `teamName` used to ride the Socket.IO query
 * string. The server copied them into inbox items other people read, so a
 * client could put anyone's name there, and the query string reaches proxy and
 * access logs. The server now takes them from the token, so the client stops
 * sending them.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebSocket } from "../hooks/common/useWebSocket";
import type { UserProps } from "../types/admin";

const ioCalls: Array<{ url: string; opts: { query: Record<string, unknown> } }> = [];

vi.mock("socket.io-client", () => ({
    io: (url: string, opts: { query: Record<string, unknown> }) => {
        ioCalls.push({ url, opts });
        return { connected: true, disconnect: vi.fn(), emit: vi.fn(), on: vi.fn(), off: vi.fn() };
    },
}));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const myself = { userId: "u-1", teamId: "t-1" } as UserProps;

describe("the socket connect query", () => {
    beforeEach(() => {
        ioCalls.length = 0;
        localStorage.clear();
        localStorage.setItem("teamId", "t-1");
        localStorage.setItem("userId", "u-1");
        // Still in storage, as they are for a signed-in user.
        localStorage.setItem("userName", "Real Person");
        localStorage.setItem("teamName", "Real Team");
        localStorage.setItem("userEmail", "real@example.com");
    });

    it("sends the user and team ids", () => {
        renderHook(() => useWebSocket("tok", myself, "t-1"));

        expect(ioCalls[0].opts.query).toMatchObject({ teamId: "t-1", userId: "u-1" });
    });

    it("sends no name, email or team name, even when they are in storage", () => {
        renderHook(() => useWebSocket("tok", myself, "t-1"));

        const query = ioCalls[0].opts.query;
        expect(Object.keys(query).sort()).toEqual(["teamId", "userId"]);
        expect(JSON.stringify(query)).not.toMatch(/Real Person|Real Team|real@example\.com/);
    });
});
