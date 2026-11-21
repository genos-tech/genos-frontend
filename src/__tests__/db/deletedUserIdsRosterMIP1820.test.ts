/**
 * The roster's `deletedUserIds` reaches the client and is kept (MIP-1820).
 *
 * `GET /team/getTeamMembers/` now answers `data.deletedUserIds`: the ids of
 * anonymised accounts that were members of the team, on a full load, an
 * incremental one and the LAST page of a paged one. A member who only left is
 * never in it. The loader reads it, the worker handler keeps it in IndexedDB (so
 * a reload still knows), and `popDeletedUserIds` hands it to the main thread.
 * Both ends are real here (loader, handler, in-memory IndexedDB); the network
 * is faked.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { usersHandlers } from "../../db/workers/handlers/users.handlers";
import { loadTeamMembers } from "../../features/admin/services/loadTeamMembers";
import { authApi } from "../../services/api";
import type { UserProps } from "../../types/admin";

vi.mock("../../services/api", () => ({ authApi: vi.fn() }));

const myself = {
    teamId: "team-a",
    teamName: "Team A",
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
} as UserProps;

const member = (id: string, extra: Record<string, unknown> = {}) => ({
    teamId: "team-a",
    teamName: "Team A",
    userId: id,
    userName: `person ${id}`,
    userEmail: `${id}@example.com`,
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "2026-01-01",
    isDeleted: false,
    ...extra,
});

/** One response (or several, one per call). `data` is what sits under `data`. */
const answer = (...pages: Array<Record<string, unknown>>) => {
    let call = 0;
    const get = vi.fn(async () => {
        const page = pages[Math.min(call, pages.length - 1)];
        call += 1;
        const more = call < pages.length;
        return {
            data: {
                server_time: `2026-11-21T00:00:0${call}Z`,
                data: page,
                has_more: more,
                next_cursor: more ? String(call) : null,
            },
        };
    });
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return get;
};

describe("loadTeamMembers reads deletedUserIds", () => {
    beforeEach(() => vi.mocked(authApi).mockReset());

    it("returns the ids of a one-page response", async () => {
        answer({ members: [member("a")], deletedUserIds: ["gone-1", "gone-2"] });
        const res = await loadTeamMembers(myself, "tok", null);
        expect(res?.deletedUserIds).toEqual(["gone-1", "gone-2"]);
    });

    it("reads them from the LAST page of a paged load, and from any page that has them", async () => {
        answer(
            { members: [member("a")] },
            { members: [member("b")] },
            { members: [member("c")], deletedUserIds: ["gone-9"] }
        );
        const res = await loadTeamMembers(myself, "tok", null);
        expect(res?.members).toHaveLength(3);
        expect(res?.deletedUserIds).toEqual(["gone-9"]);
    });

    it("reads them on an incremental load too", async () => {
        answer({
            members: [member("left", { isDeleted: true })],
            deletedUserIds: ["gone-1"],
        });
        const res = await loadTeamMembers(myself, "tok", "2026-11-01T00:00:00Z");
        expect(res?.deletedUserIds).toEqual(["gone-1"]);
    });

    it("a missing key (an older API, a guest) is an empty list", async () => {
        answer({ members: [member("a")] });
        const res = await loadTeamMembers(myself, "tok", null);
        expect(res?.deletedUserIds).toEqual([]);
        expect(res?.members).toHaveLength(1);
    });

    it("ignores a malformed value instead of throwing", async () => {
        answer({ members: [member("a")], deletedUserIds: "nope" });
        const res = await loadTeamMembers(myself, "tok", null);
        expect(res?.deletedUserIds).toEqual([]);

        answer({ members: [member("a")], deletedUserIds: ["ok", 7, null, ""] });
        const res2 = await loadTeamMembers(myself, "tok", null);
        expect(res2?.deletedUserIds).toEqual(["ok"]);
    });
});

describe("the worker handler keeps them for the next boot", () => {
    beforeEach(async () => {
        vi.mocked(authApi).mockReset();
        await deleteDB(DB_NAME);
    });

    const sync = () => usersHandlers.loadTeamMembers({ myself, accessToken: "tok" } as never);
    const kept = () => usersHandlers.popDeletedUserIds({} as never);

    it("a full load stores them, and a later read (a reload) returns them sorted", async () => {
        answer({ members: [member("a")], deletedUserIds: ["gone-2", "gone-1"] });
        await sync();
        expect(await kept()).toEqual(["gone-1", "gone-2"]);
    });

    it("an incremental load adds to them, and a deleted account never comes back", async () => {
        answer({ members: [member("a")], deletedUserIds: ["gone-1"] });
        await sync();
        answer({ members: [], deletedUserIds: ["gone-2"] });
        await sync();
        expect(await kept()).toEqual(["gone-1", "gone-2"]);
    });

    it("a response without the key changes nothing and stores nothing", async () => {
        answer({ members: [member("a")] });
        await sync();
        expect(await kept()).toEqual([]);

        answer({ members: [member("a")], deletedUserIds: ["gone-1"] });
        await sync();
        answer({ members: [member("a")] });
        await sync();
        expect(await kept()).toEqual(["gone-1"]);
    });

    it("a member who left (tombstone, not listed) is not reported deleted", async () => {
        answer({ members: [member("left", { isDeleted: true })], deletedUserIds: [] });
        await sync();
        expect(await kept()).toEqual([]);
    });

    it("a row still cached under a real name is dropped once the roster lists it as deleted", async () => {
        answer({ members: [member("a"), member("eve")] });
        await sync();
        answer({ members: [], deletedUserIds: ["eve"] });
        await sync();
        const roster = await usersHandlers.popTeamMembers({ myself } as never);
        expect(roster.map((m) => m.userId)).toEqual(["a"]);
    });

    it("a failed sync does not store the ids it fetched", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    server_time: "t",
                    data: { members: [member("a")], deletedUserIds: ["gone-1"] },
                    has_more: true,
                    next_cursor: "1",
                },
            })
            .mockRejectedValueOnce(new Error("boom"));
        vi.mocked(authApi).mockReturnValue({ get } as never);
        await expect(sync()).rejects.toThrow();
        expect(await kept()).toEqual([]);
    });
});
