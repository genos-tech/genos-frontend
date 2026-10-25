/**
 * The chat list follows the server's pages to the end (MIP-808).
 *
 * `GET /api/v3/channels/` can be paged (`limit` + `cursor`, answered with
 * `has_more` + `next_cursor`). `refreshChannels` hands the result straight to
 * `reconcileChannelList`, which EVICTS every local channel the list does not
 * name, along with its messages, cursors, members and pins, and documents that
 * it "MUST only be called with an authoritative full list". So a list that
 * stopped at the first page would delete every channel past the cut from the
 * sidebar and from the local store, with no error. These tests run the real
 * service end to end; only the network is faked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";

const get = vi.fn();

vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
        isAxiosError: () => false,
    },
}));

vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const TEAM = "11111111-1111-1111-1111-111111111111";

const channel = (n: number) => ({
    id: `chan-${String(n).padStart(3, "0")}`,
    kind: 2,
    title: `chat ${n}`,
    profileImageUrl: "",
    projectId: null,
    ownerId: null,
    isPrivate: false,
    legacyChatId: null,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

/** A server holding `total` channels, `pageSize` at a time, in id order. */
const serve = (total: number, pageSize: number) => {
    const all = Array.from({ length: total }, (_, i) => channel(i + 1));
    get.mockImplementation(async (_url: string, config?: { params?: Record<string, string> }) => {
        const after = config?.params?.cursor ?? "";
        const rest = all.filter((c) => c.id > after);
        const page = rest.slice(0, pageSize);
        const more = rest.length > pageSize;
        return {
            data: {
                channels: page,
                has_more: more,
                next_cursor: more ? page[page.length - 1].id : null,
            },
        };
    });
    return all;
};

const ids = () => [...channelService.getSnapshot().channels.keys()].sort();

describe("listChannels follows the pages", () => {
    beforeEach(() => {
        get.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("user-a");
        channelService.setCurrentTeamId(null);
        channelService.setCurrentTeamId(TEAM);
    });

    it("returns every channel of a list larger than one page", async () => {
        serve(25, 10);

        const list = await channelService.listChannels();

        expect(list).toHaveLength(25);
        expect(list.map((c) => c.id)).toEqual(
            Array.from({ length: 25 }, (_, i) => `chan-${String(i + 1).padStart(3, "0")}`)
        );
        expect(get).toHaveBeenCalledTimes(3);
    });

    it("sends the cursor on every page after the first, and not on the first", async () => {
        serve(25, 10);

        await channelService.listChannels();

        expect(get.mock.calls[0][1].params).not.toHaveProperty("cursor");
        expect(get.mock.calls[1][1].params.cursor).toBe("chan-010");
        expect(get.mock.calls[2][1].params.cursor).toBe("chan-020");
    });

    it("keeps the team and the page size on every page", async () => {
        serve(25, 10);

        await channelService.listChannels();

        for (const call of get.mock.calls) {
            expect(call[1].params.team_id).toBe(TEAM);
            expect(call[1].params.limit).toBe(200);
        }
    });

    it("makes one request for a list that fits in a page", async () => {
        serve(5, 10);

        const list = await channelService.listChannels();

        expect(list).toHaveLength(5);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("treats a server that predates paging as a single page, as before", async () => {
        get.mockResolvedValue({ data: { channels: [channel(1), channel(2)] } });

        const list = await channelService.listChannels();

        expect(list).toHaveLength(2);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("stops if has_more arrives without a cursor, rather than looping", async () => {
        get.mockResolvedValue({
            data: { channels: [channel(1)], has_more: true, next_cursor: null },
        });

        const list = await channelService.listChannels();

        expect(list).toHaveLength(1);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("throws on a server that never says it is done, instead of returning a short list", async () => {
        get.mockResolvedValue({
            data: { channels: [channel(1)], has_more: true, next_cursor: "again" },
        });

        await expect(channelService.listChannels()).rejects.toThrow();
        expect(get.mock.calls.length).toBeLessThanOrEqual(50);
    });

    it("throws if a later page fails, instead of returning a short list", async () => {
        get.mockResolvedValueOnce({
            data: { channels: [channel(1)], has_more: true, next_cursor: "chan-001" },
        }).mockRejectedValueOnce(new Error("boom"));

        await expect(channelService.listChannels()).rejects.toThrow();
    });

    it("shares one multi-page fetch between concurrent callers", async () => {
        serve(25, 10);

        const [a, b] = await Promise.all([
            channelService.listChannels(),
            channelService.listChannels(),
        ]);

        expect(a).toHaveLength(25);
        expect(b).toHaveLength(25);
        expect(get).toHaveBeenCalledTimes(3);
    });
});

describe("refreshChannels never evicts a real channel", () => {
    beforeEach(() => {
        get.mockReset();
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("user-a");
        channelService.setCurrentTeamId(null);
        channelService.setCurrentTeamId(TEAM);
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "info").mockImplementation(() => {});
    });

    it("a list larger than one page keeps every channel, past the first page too", async () => {
        serve(25, 10);

        await channelService.refreshChannels();

        expect(ids()).toHaveLength(25);
        expect(ids()).toContain("chan-025");
    });

    it("a channel the server really dropped is still evicted (reconcile still works)", async () => {
        serve(25, 10);
        await channelService.refreshChannels();
        expect(ids()).toContain("chan-013");
        // The server stops listing chan-013 (we were removed from it).
        const all = Array.from({ length: 25 }, (_, i) => channel(i + 1)).filter(
            (c) => c.id !== "chan-013"
        );
        get.mockImplementation(async (_u: string, cfg?: { params?: Record<string, string> }) => {
            const rest = all.filter((c) => c.id > (cfg?.params?.cursor ?? ""));
            const page = rest.slice(0, 10);
            const more = rest.length > 10;
            return {
                data: {
                    channels: page,
                    has_more: more,
                    next_cursor: more ? page[page.length - 1].id : null,
                },
            };
        });

        await channelService.refreshChannels();

        expect(ids()).not.toContain("chan-013");
        expect(ids()).toHaveLength(24);
    });

    it("a failed later page evicts nothing", async () => {
        serve(25, 10);
        await channelService.refreshChannels();
        const before = ids();
        get.mockReset();
        get.mockResolvedValueOnce({
            data: { channels: [channel(1)], has_more: true, next_cursor: "chan-001" },
        }).mockRejectedValueOnce(new Error("boom"));

        await channelService.refreshChannels();

        expect(ids()).toEqual(before);
    });

    it("a runaway server evicts nothing", async () => {
        serve(25, 10);
        await channelService.refreshChannels();
        const before = ids();
        get.mockReset();
        get.mockResolvedValue({
            data: { channels: [channel(1)], has_more: true, next_cursor: "again" },
        });

        await channelService.refreshChannels();

        expect(ids()).toEqual(before);
    });
});
