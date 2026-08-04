/**
 * A heartbeat says whether someone is online. It must not say which team
 * they are on.
 *
 * The `userStatus` socket message carries the SENDER's `myself`, so its
 * `teamId` is whichever team that person is looking at. Now that presence
 * crosses team boundaries (a cross-team collaborator has to be able to
 * appear online), writing that payload straight over the stored row would
 * refile the person under their own team — and the store is read back with
 * `getTeamMembers(myTeam)`, so they would silently drop out of the roster
 * every surface names people from, taking `isExternal` / `homeTeam*` with
 * them. The symptom is the one this whole feature set exists to remove: a
 * nameless blank circle.
 *
 * Real in-memory IndexedDB, because the thing under test is which rows the
 * `teamId` index returns afterwards.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { UserRepository } from "../../db/repositories";
import { usersHandlers } from "../../db/workers/handlers/users.handlers";
import type { UserProps } from "../../types/admin";

vi.mock("../../features/admin/services/loadTeamMembers", () => ({
    loadTeamMembers: vi.fn(),
}));

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const MY_TEAM = "team-a";
const THEIR_TEAM = "team-b";

// How the roster stores someone from another team: filed under the team
// whose roster it is, with their own team alongside.
const rosterRow: UserProps = {
    teamId: MY_TEAM,
    teamName: "Team A",
    userId: "u-bob",
    userName: "Bob",
    userEmail: "bob@team-b.test",
    avatarImgPath: "bob.jpg",
    tsLastSeen: "",
    tsJoined: "2026-01-01",
    memberRole: "guest",
    isExternal: true,
    homeTeamId: THEIR_TEAM,
    homeTeamName: "Team B",
    homeTeamImgPath: "team-b.png",
};

// What Bob's own client broadcasts: his `myself`, which knows nothing about
// the roster it is about to land in.
const heartbeat: UserProps = {
    teamId: THEIR_TEAM,
    teamName: "Team B",
    userId: "u-bob",
    userName: "Bob",
    userEmail: "bob@team-b.test",
    avatarImgPath: "bob-new.jpg",
    tsLastSeen: "2026-08-04T12:00:00Z",
    tsJoined: "2026-01-01",
    customStatus: "in a meeting",
};

const beat = (user: UserProps) => usersHandlers.addUser({ user } as never);

describe("presence updates a person's status, not their team", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("leaves an external collaborator in the roster that holds them", async () => {
        const repo = new UserRepository();
        await repo.saveUser(rosterRow);

        await beat(heartbeat);

        const stored = await repo.getUser("u-bob");
        expect(stored?.teamId).toBe(MY_TEAM);
        expect(stored?.isExternal).toBe(true);
        expect(stored?.homeTeamId).toBe(THEIR_TEAM);
        expect(stored?.homeTeamName).toBe("Team B");
        expect(stored?.homeTeamImgPath).toBe("team-b.png");
        // Still on the index the roster is read by — the whole point.
        expect((await repo.getTeamMembers(MY_TEAM)).map((u) => u.userId)).toEqual(["u-bob"]);
    });

    it("still takes everything a heartbeat is for", async () => {
        const repo = new UserRepository();
        await repo.saveUser(rosterRow);

        await beat(heartbeat);

        const stored = await repo.getUser("u-bob");
        expect(stored?.tsLastSeen).toBe("2026-08-04T12:00:00Z");
        expect(stored?.customStatus).toBe("in a meeting");
        expect(stored?.avatarImgPath).toBe("bob-new.jpg");
    });

    it("stores someone it has never seen as they describe themselves", async () => {
        // No roster row to defer to: a heartbeat is all we know, and
        // dropping it would leave the person unnamed everywhere.
        await beat(heartbeat);

        const stored = await new UserRepository().getUser("u-bob");
        expect(stored?.teamId).toBe(THEIR_TEAM);
        expect(stored?.tsLastSeen).toBe("2026-08-04T12:00:00Z");
    });
});
