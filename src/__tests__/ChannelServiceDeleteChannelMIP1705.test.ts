/**
 * MIP-1705: `channelService.deleteChannel` asks the server to delete a group chat and then drops
 * it from this device.
 *
 * The drop is not a local `delete` of our own: it is the chat-list re-read, whose reconcile
 * evicts what the server no longer lists. So the test serves a list WITHOUT the chat after the
 * delete and checks the chat is really gone from the store, and that a refused delete leaves it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";

const get = vi.fn();
const del = vi.fn();

vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: del }),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const GROUP = "11111111-1111-4111-8111-111111111111";
const KEPT = "22222222-2222-4222-8222-222222222222";

const channel = (id: string) => ({
    id,
    kind: 2,
    title: id,
    profileImageUrl: "",
    projectId: null,
    ownerId: "u-owner",
    isPrivate: false,
    legacyChatId: null,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

describe("channelService.deleteChannel", () => {
    beforeEach(() => {
        get.mockReset();
        del.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("u-owner");
        channelService.setCurrentTeamId(null);
        channelService.handleChannelCreated(channel(GROUP) as never);
        channelService.handleChannelCreated(channel(KEPT) as never);
    });

    it("asks for a soft delete unless told otherwise", async () => {
        del.mockResolvedValue({ data: { deleted: true } });
        get.mockResolvedValue({ data: { channels: [channel(KEPT)] } });

        await channelService.deleteChannel(GROUP);

        expect(del).toHaveBeenCalledWith(`/api/v3/channels/${GROUP}/`, {
            params: { mode: "soft" },
        });
    });

    it("sends hard when asked", async () => {
        del.mockResolvedValue({ data: { deleted: true } });
        get.mockResolvedValue({ data: { channels: [channel(KEPT)] } });

        await channelService.deleteChannel(GROUP, "hard");

        expect(del).toHaveBeenCalledWith(`/api/v3/channels/${GROUP}/`, {
            params: { mode: "hard" },
        });
    });

    it("drops the chat from this device and keeps the others", async () => {
        del.mockResolvedValue({ data: { deleted: true } });
        get.mockResolvedValue({ data: { channels: [channel(KEPT)] } });
        expect(channelService.getSnapshot().channels.has(GROUP)).toBe(true);

        await channelService.deleteChannel(GROUP, "soft");

        const held = channelService.getSnapshot().channels;
        expect(held.has(GROUP)).toBe(false);
        expect(held.has(KEPT)).toBe(true);
    });

    it("a refused delete throws, leaves the chat, and does not re-read the list", async () => {
        del.mockRejectedValue({
            isAxiosError: true,
            message: "Request failed",
            response: { status: 403, data: { error: "Only the channel owner can delete it." } },
        });

        await expect(channelService.deleteChannel(GROUP, "hard")).rejects.toMatchObject({
            code: "FORBIDDEN",
        });

        expect(get).not.toHaveBeenCalled();
        expect(channelService.getSnapshot().channels.has(GROUP)).toBe(true);
    });

    it("a failed refresh afterwards does not turn a done delete into an error", async () => {
        del.mockResolvedValue({ data: { deleted: true } });
        get.mockRejectedValue(new Error("offline"));

        await expect(channelService.deleteChannel(GROUP)).resolves.toBeUndefined();
    });
});
