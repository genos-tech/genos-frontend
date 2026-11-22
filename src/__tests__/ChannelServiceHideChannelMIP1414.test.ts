/**
 * MIP-1414: `channelService.hideChannel` / `unhideChannel` ("Remove from sidebar").
 *
 * Hiding takes the chat out of the store at once (optimistic) and keeps the others; when the
 * server refuses, the list is re-read, which brings the chat back, and the error is thrown.
 * Unhiding asks the server and then re-reads the list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post, patch: vi.fn(), delete: del }),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const DM = "11111111-1111-4111-8111-111111111111";
const KEPT = "22222222-2222-4222-8222-222222222222";

const channel = (id: string) => ({
    id,
    kind: 1,
    title: "",
    profileImageUrl: "",
    projectId: null,
    ownerId: null,
    isPrivate: true,
    legacyChatId: null,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

describe("channelService.hideChannel", () => {
    beforeEach(() => {
        get.mockReset();
        post.mockReset();
        del.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("u-me");
        channelService.setCurrentTeamId(null);
        channelService.handleChannelCreated(channel(DM) as never);
        channelService.handleChannelCreated(channel(KEPT) as never);
    });

    it("posts the hide and drops only that chat from the store", async () => {
        post.mockResolvedValue({ status: 204 });
        await channelService.hideChannel(DM);
        expect(post).toHaveBeenCalledWith(`/api/v3/channels/${DM}/hide/`);
        const held = channelService.getSnapshot().channels;
        expect(held.has(DM)).toBe(false);
        expect(held.has(KEPT)).toBe(true);
    });

    it("drops my pin on the chat with it (MIP-1991) and keeps other pins", async () => {
        post.mockResolvedValue({ status: 204 });
        const svc = channelService as unknown as {
            _upsertPin: (p: { id: string; channelId: string; tsCreated: string }) => void;
        };
        svc._upsertPin({ id: "p1", channelId: DM, tsCreated: "2026-01-01T00:00:00Z" });
        svc._upsertPin({ id: "p2", channelId: KEPT, tsCreated: "2026-01-01T00:00:00Z" });
        await channelService.hideChannel(DM);
        const pins = channelService.getSnapshot().pins;
        expect(pins.has("p1")).toBe(false);
        expect(pins.has("p2")).toBe(true);
    });

    it("brings the chat back when it is announced again (reopened from search, MIP-1991)", async () => {
        post.mockResolvedValue({ status: 204 });
        await channelService.hideChannel(DM);
        expect(channelService.getSnapshot().channels.has(DM)).toBe(false);
        channelService.handleChannelCreated(channel(DM) as never);
        expect(channelService.getSnapshot().channels.has(DM)).toBe(true);
    });

    it("removes the chat before the server answers", async () => {
        let release: (v: unknown) => void = () => {};
        post.mockReturnValue(new Promise((r) => (release = r)));
        const pending = channelService.hideChannel(DM);
        expect(channelService.getSnapshot().channels.has(DM)).toBe(false);
        release({ status: 204 });
        await pending;
    });

    it("rolls back (re-reads the list) and throws when the server refuses", async () => {
        post.mockRejectedValue(new Error("boom"));
        get.mockResolvedValue({ data: { channels: [channel(DM), channel(KEPT)] } });
        await expect(channelService.hideChannel(DM)).rejects.toBeTruthy();
        expect(channelService.getSnapshot().channels.has(DM)).toBe(true);
    });

    it("unhide asks the server, then re-reads the list so the chat appears", async () => {
        post.mockResolvedValue({ status: 204 });
        await channelService.hideChannel(DM);
        del.mockResolvedValue({ status: 204 });
        get.mockResolvedValue({ data: { channels: [channel(DM), channel(KEPT)] } });
        await channelService.unhideChannel(DM);
        expect(del).toHaveBeenCalledWith(`/api/v3/channels/${DM}/hide/`);
        expect(channelService.getSnapshot().channels.has(DM)).toBe(true);
    });
});
