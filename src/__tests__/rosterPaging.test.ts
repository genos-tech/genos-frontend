/**
 * The team roster follows the server's pages to the end (MIP-805).
 *
 * `getTeamMembers` can be paged (`limit` + `cursor`, answered with `has_more` +
 * `next_cursor`). The loader's caller stores the response's `server_time` as
 * its next `since`, so a roster that stopped at the first page would be
 * recorded as complete and everyone past the cut would render as a blank
 * circle with no name, with nothing ever fetching them. So the loader fetches
 * every page BEFORE returning. Both ends here are real: the loader, the worker
 * handler and an in-memory IndexedDB; only the network is faked.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { usersHandlers } from "../db/workers/handlers/users.handlers";
import { loadTeamMembers } from "../features/admin/services/loadTeamMembers";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const MY_TEAM = "team-a";

const myself = {
    teamId: MY_TEAM,
    teamName: "Team A",
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
} as UserProps;

const member = (n: number) => ({
    teamId: MY_TEAM,
    teamName: "Team A",
    userId: `u-${String(n).padStart(3, "0")}`,
    userName: `person ${n}`,
    userEmail: `p${n}@example.com`,
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "2026-01-01",
    isDeleted: false,
});

/** A server holding `total` members, `pageSize` at a time. */
const serve = (total: number, pageSize: number) => {
    const all = Array.from({ length: total }, (_, i) => member(i + 1));
    let clock = 0;
    const get = vi.fn(async (url: string) => {
        const query = new URLSearchParams(url.split("?")[1] ?? "");
        const start = query.get("cursor") ? Number(query.get("cursor")) : 0;
        const page = all.slice(start, start + pageSize);
        const more = start + pageSize < total;
        clock += 1;
        return {
            data: {
                server_time: `2026-08-04T00:00:0${clock}Z`,
                data: { members: page },
                has_more: more,
                next_cursor: more ? String(start + pageSize) : null,
            },
        };
    });
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return { all, get };
};

const urlOf = (get: ReturnType<typeof vi.fn>, call: number) => String(get.mock.calls[call][0]);

describe("loadTeamMembers follows the pages", () => {
    beforeEach(() => {
        vi.mocked(authApi).mockReset();
    });

    it("returns every member of a roster larger than one page", async () => {
        serve(25, 10);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res?.members).toHaveLength(25);
        expect(res?.members.map((m) => m.userId)).toEqual(
            Array.from({ length: 25 }, (_, i) => `u-${String(i + 1).padStart(3, "0")}`)
        );
    });

    it("sends the cursor on every page after the first, and not on the first", async () => {
        const { get } = serve(25, 10);

        await loadTeamMembers(myself, "tok", null);

        expect(get).toHaveBeenCalledTimes(3);
        expect(urlOf(get, 0)).not.toContain("cursor=");
        expect(urlOf(get, 1)).toContain("cursor=10");
        expect(urlOf(get, 2)).toContain("cursor=20");
    });

    it("keeps the team and since on every page", async () => {
        const { get } = serve(25, 10);

        await loadTeamMembers(myself, "tok", "2026-07-01T00:00:00Z");

        for (let i = 0; i < 3; i += 1) {
            expect(urlOf(get, i)).toContain(`team_id=${MY_TEAM}`);
            expect(urlOf(get, i)).toContain("since=2026-07-01T00%3A00%3A00Z");
            expect(urlOf(get, i)).toContain("limit=");
        }
    });

    it("uses the FIRST page's clock", async () => {
        serve(25, 10);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res?.serverTime).toBe("2026-08-04T00:00:01Z");
    });

    it("makes one request for a roster that fits in a page", async () => {
        const { get } = serve(5, 10);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res?.members).toHaveLength(5);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("treats a server that predates paging as a single page, as before", async () => {
        const get = vi.fn(async () => ({
            data: { server_time: "t", data: { members: [member(1), member(2)] } },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res?.members).toHaveLength(2);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("stops if has_more arrives without a cursor, rather than looping", async () => {
        const get = vi.fn(async () => ({
            data: {
                server_time: "t",
                data: { members: [member(1)] },
                has_more: true,
                next_cursor: null,
            },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res?.members).toHaveLength(1);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("gives up on a server that never says it is done, and returns nothing", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const get = vi.fn(async () => ({
            data: {
                server_time: "t",
                data: { members: [member(1)] },
                has_more: true,
                next_cursor: "again",
            },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res).toBeUndefined();
        expect(get.mock.calls.length).toBeLessThanOrEqual(50);
    });

    it("returns nothing if a later page fails, instead of a short roster", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t",
                    data: { members: [member(1)] },
                    has_more: true,
                    next_cursor: "10",
                },
            })
            .mockRejectedValueOnce(new Error("boom"));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        const res = await loadTeamMembers(myself, "tok", null);

        expect(res).toBeUndefined();
    });
});

describe("the worker handler caches every member of a long roster", () => {
    beforeEach(async () => {
        vi.mocked(authApi).mockReset();
        await deleteDB(DB_NAME);
    });

    it("a team larger than one page shows every member and nothing is evicted", async () => {
        serve(25, 10);

        const roster = await usersHandlers.loadTeamMembers({
            myself,
            accessToken: "tok",
        } as never);

        expect(roster).toHaveLength(25);
        expect(new Set(roster.map((m) => m.userId)).size).toBe(25);
    });

    it("a failed later page leaves the cache as it was", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        // Seed one cached member the failed sync must not disturb.
        const seeded = serve(3, 10);
        await usersHandlers.loadTeamMembers({ myself, accessToken: "tok" } as never);
        expect(seeded.all).toHaveLength(3);

        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t2",
                    data: { members: [member(99)] },
                    has_more: true,
                    next_cursor: "10",
                },
            })
            .mockRejectedValueOnce(new Error("boom"));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        await expect(
            usersHandlers.loadTeamMembers({ myself, accessToken: "tok" } as never)
        ).rejects.toThrow();

        const roster = await usersHandlers.popTeamMembers({ myself } as never);
        expect(roster.map((m) => m.userId).sort()).toEqual(["u-001", "u-002", "u-003"]);
    });
});
