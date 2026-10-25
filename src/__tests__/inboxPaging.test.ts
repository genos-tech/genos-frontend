/**
 * The inbox follows the server's pages to the end (MIP-806).
 *
 * `GET /inbox/` can be paged (`limit` + `cursor`, answered with `has_more` +
 * `next_cursor`). The handler applies a FULL load by clearing the inbox store
 * and inserting what arrived, and stores the response's `server_time` as the
 * next `since`. So an inbox that stopped at the first page would wipe every
 * older item from the client for good, with no error. The loader therefore
 * fetches every page BEFORE returning. The loader, the worker handler and an
 * in-memory IndexedDB are real; only the network is faked.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { InboxRepository } from "../db/repositories";
import { inboxHandlers } from "../db/workers/handlers/inbox.handlers";
import { loadInbox } from "../features/inbox/services/loadInbox";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const TEAM = "team-a";
const ME = "u-me";

const myself = { teamId: TEAM, userId: ME, userName: "Me" } as UserProps;

const item = (id: number, over: Record<string, unknown> = {}) => ({
    itemId: id,
    itemBody: [],
    itemType: 1,
    isRead: false,
    requestStatus: "pending",
    isDeleted: false,
    tsSent: new Date(Date.now() - id * 60_000).toISOString(),
    itemOptionals: null,
    ...over,
});

/** A server holding items 1..total, `pageSize` at a time, in item_id order. */
const serve = (total: number, pageSize: number) => {
    const all = Array.from({ length: total }, (_, i) => item(i + 1));
    let clock = 0;
    const get = vi.fn(async (url: string) => {
        const query = new URLSearchParams(url.split("?")[1] ?? "");
        const after = query.get("cursor") ? Number(query.get("cursor")) : 0;
        const page = all.filter((i) => i.itemId > after).slice(0, pageSize);
        const more = all.some((i) => i.itemId > after + pageSize);
        clock += 1;
        return {
            data: {
                server_time: `2026-08-04T00:00:0${clock}Z`,
                data: { items: page },
                has_more: more,
                next_cursor: more ? String(page[page.length - 1].itemId) : null,
            },
        };
    });
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return { all, get };
};

const urlOf = (get: ReturnType<typeof vi.fn>, call: number) => String(get.mock.calls[call][0]);

describe("loadInbox follows the pages", () => {
    beforeEach(() => {
        vi.mocked(authApi).mockReset();
    });

    it("returns every item of an inbox larger than one page", async () => {
        serve(25, 10);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res?.items).toHaveLength(25);
        expect(res?.items.map((i) => i.itemId)).toEqual(
            Array.from({ length: 25 }, (_, i) => i + 1)
        );
    });

    it("sends the cursor on every page after the first, and not on the first", async () => {
        const { get } = serve(25, 10);

        await loadInbox(TEAM, ME, "tok", null);

        expect(get).toHaveBeenCalledTimes(3);
        expect(urlOf(get, 0)).not.toContain("cursor=");
        expect(urlOf(get, 1)).toContain("cursor=10");
        expect(urlOf(get, 2)).toContain("cursor=20");
    });

    it("keeps the team, user and since on every page", async () => {
        const { get } = serve(25, 10);

        await loadInbox(TEAM, ME, "tok", "2026-07-01T00:00:00Z");

        for (let i = 0; i < 3; i += 1) {
            expect(urlOf(get, i)).toContain(`team_id=${TEAM}`);
            expect(urlOf(get, i)).toContain(`user_id=${ME}`);
            expect(urlOf(get, i)).toContain("since=2026-07-01T00%3A00%3A00Z");
            expect(urlOf(get, i)).toContain("limit=");
        }
    });

    it("uses the FIRST page's clock", async () => {
        serve(25, 10);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res?.serverTime).toBe("2026-08-04T00:00:01Z");
    });

    it("makes one request for an inbox that fits in a page", async () => {
        const { get } = serve(5, 10);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res?.items).toHaveLength(5);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("carries a tombstone that arrives on a later page", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t",
                    data: { items: [item(1)] },
                    has_more: true,
                    next_cursor: "1",
                },
            })
            .mockResolvedValueOnce({
                data: { server_time: "t2", data: { items: [item(2, { isDeleted: true })] } },
            });
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadInbox(TEAM, ME, "tok", "2026-07-01T00:00:00Z");

        expect(res?.items.map((i) => [i.itemId, i.isDeleted])).toEqual([
            [1, false],
            [2, true],
        ]);
    });

    it("treats a server that predates paging as a single page, as before", async () => {
        const get = vi.fn(async () => ({
            data: { server_time: "t", data: { items: [item(1), item(2)] } },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res?.items).toHaveLength(2);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("stops if has_more arrives without a cursor, rather than looping", async () => {
        const get = vi.fn(async () => ({
            data: {
                server_time: "t",
                data: { items: [item(1)] },
                has_more: true,
                next_cursor: null,
            },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res?.items).toHaveLength(1);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("gives up on a server that never says it is done, and returns nothing", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const get = vi.fn(async () => ({
            data: {
                server_time: "t",
                data: { items: [item(1)] },
                has_more: true,
                next_cursor: "again",
            },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res).toBeUndefined();
        expect(get.mock.calls.length).toBeLessThanOrEqual(50);
    });

    it("returns nothing if a later page fails, instead of a short inbox", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t",
                    data: { items: [item(1)] },
                    has_more: true,
                    next_cursor: "1",
                },
            })
            .mockRejectedValueOnce(new Error("boom"));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadInbox(TEAM, ME, "tok", null);

        expect(res).toBeUndefined();
    });
});

describe("the worker handler stores every item of a long inbox", () => {
    beforeEach(async () => {
        vi.mocked(authApi).mockReset();
        await deleteDB(DB_NAME);
    });

    it("an inbox larger than one page shows every item and nothing is evicted", async () => {
        serve(25, 10);

        await inboxHandlers.loadInbox({ myself, accessToken: "tok" } as never);

        const stored = await inboxHandlers.popInboxItems({} as never);
        expect(stored).toHaveLength(25);
        expect(new Set(stored.map((i) => i.itemId)).size).toBe(25);
    });

    it("a failed later page leaves the stored inbox exactly as it was", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        // A full load clears the store, so a partial one would destroy this item.
        await new InboxRepository().put(item(500) as never);
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t",
                    data: { items: [item(1)] },
                    has_more: true,
                    next_cursor: "1",
                },
            })
            .mockRejectedValueOnce(new Error("boom"));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        await expect(
            inboxHandlers.loadInbox({ myself, accessToken: "tok" } as never)
        ).rejects.toThrow();

        const stored = await inboxHandlers.popInboxItems({} as never);
        expect(stored.map((i) => i.itemId)).toEqual([500]);
    });
});
