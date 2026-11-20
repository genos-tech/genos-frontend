/**
 * MIP-1715: `channelService.listDeletedChannels` / `restoreChannel`.
 *
 * The restore brings the chat into this device's sidebar through `refreshChannels` (ingests the
 * list), NOT `listChannels` (only returns it): the test serves a list WITH the chat after the
 * restore and checks it is really in the store, and that a refused restore changes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";

const get = vi.fn();
const post = vi.fn();

vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post, patch: vi.fn(), delete: vi.fn() }),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

// A fresh id per test: the service is a singleton, so a chat ingested by one test stays for the next.
let n = 0;
let GROUP = "";
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

describe("channelService.listDeletedChannels", () => {
    beforeEach(() => {
        get.mockReset();
        post.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("u-owner");
        channelService.setCurrentTeamId(null);
    });

    it("asks for the given team's deleted groups and returns the rows", async () => {
        const rows = [
            { id: GROUP, title: "Old", isPrivate: true, deletedAt: "2026-11-20", memberCount: 3 },
        ];
        get.mockResolvedValue({ data: { channels: rows } });

        await expect(channelService.listDeletedChannels("team-1")).resolves.toEqual(rows);

        expect(get).toHaveBeenCalledWith("/api/v3/channels/deleted/", {
            params: { team_id: "team-1" },
        });
    });

    it("a server with no rows key is an empty list, and a failure throws a typed error", async () => {
        get.mockResolvedValueOnce({ data: {} });
        await expect(channelService.listDeletedChannels("t")).resolves.toEqual([]);

        get.mockRejectedValueOnce({
            isAxiosError: true,
            message: "boom",
            response: { status: 500, data: {} },
        });
        await expect(channelService.listDeletedChannels("t")).rejects.toMatchObject({
            code: "BACKEND_ERROR",
        });
    });
});

describe("channelService.restoreChannel", () => {
    beforeEach(() => {
        n += 1;
        GROUP = `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
        get.mockReset();
        post.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("u-owner");
        channelService.setCurrentTeamId(null);
        channelService.handleChannelCreated(channel(KEPT) as never);
    });

    it("posts the restore", async () => {
        post.mockResolvedValue({ data: { restored: true } });
        get.mockResolvedValue({ data: { channels: [channel(KEPT), channel(GROUP)] } });

        await channelService.restoreChannel(GROUP);

        expect(post).toHaveBeenCalledWith(`/api/v3/channels/${GROUP}/restore/`);
    });

    it("brings the chat into this device's store and keeps the others", async () => {
        post.mockResolvedValue({ data: { restored: true } });
        get.mockResolvedValue({ data: { channels: [channel(KEPT), channel(GROUP)] } });
        expect(channelService.getSnapshot().channels.has(GROUP)).toBe(false);

        await channelService.restoreChannel(GROUP);

        const held = channelService.getSnapshot().channels;
        expect(held.has(GROUP)).toBe(true);
        expect(held.has(KEPT)).toBe(true);
    });

    it("a refused restore throws NOT_FOUND, leaves the store, and does not re-read the list", async () => {
        post.mockRejectedValue({
            isAxiosError: true,
            message: "Request failed",
            response: { status: 404, data: { detail: "Not found." } },
        });

        await expect(channelService.restoreChannel(GROUP)).rejects.toMatchObject({
            code: "NOT_FOUND",
        });

        expect(get).not.toHaveBeenCalled();
        expect(channelService.getSnapshot().channels.has(GROUP)).toBe(false);
    });

    it("a failed refresh afterwards does not turn a done restore into an error", async () => {
        post.mockResolvedValue({ data: { restored: true } });
        get.mockRejectedValue(new Error("offline"));

        await expect(channelService.restoreChannel(GROUP)).resolves.toBeUndefined();
    });
});
