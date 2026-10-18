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
    // Browser-reported zone the roster is the authority on. The profile
    // card's location and local-time rows resolve from it. A beat never
    // carries `timezone` (see `useAuth`), so this is the value that has to
    // survive one.
    timezone: "Asia/Tokyo",
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

    it("keeps the browser-reported timezone a beat never carries", async () => {
        // The beat carries the sender's `myself`, which has no `timezone`
        // key at all. Spreading it straight over the stored row dropped
        // the field, so the profile card's location and local-time rows
        // (which resolve `currentLocation or timezone`) went blank within
        // one beat — ≤60s — of a full roster load. The roster owns it.
        const repo = new UserRepository();
        await repo.saveUser(rosterRow);

        await beat(heartbeat);

        const stored = await repo.getUser("u-bob");
        expect(stored?.timezone).toBe("Asia/Tokyo");
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

    it("keeps the contact details a server-built card leaves out", async () => {
        // The socket layer now sends genos-api's presence card instead of
        // the sender's `myself` (MIP-715). It has no `phoneNumber` or
        // `userEmail`, because it reaches the far side of every cross-team
        // share. Replacing the stored row with it blanked both on the
        // profile card within one beat.
        const repo = new UserRepository();
        await repo.saveUser({ ...rosterRow, phoneNumber: "+81-90-0000-0000" });

        const { userEmail: _email, teamId: _team, teamName: _teamName, ...card } = heartbeat;
        await beat(card as UserProps);

        const stored = await repo.getUser("u-bob");
        expect(stored?.userEmail).toBe("bob@team-b.test");
        expect(stored?.phoneNumber).toBe("+81-90-0000-0000");
        expect(stored?.teamId).toBe(MY_TEAM);
        expect(stored?.avatarImgPath).toBe("bob-new.jpg");
        expect(stored?.tsLastSeen).toBe("2026-08-04T12:00:00Z");
    });

    it("stores someone it has never seen as they describe themselves", async () => {
        // No roster row to defer to: a heartbeat is all we know, and
        // dropping it would leave the person unnamed everywhere.
        await beat(heartbeat);

        const stored = await new UserRepository().getUser("u-bob");
        expect(stored?.teamId).toBe(THEIR_TEAM);
        expect(stored?.tsLastSeen).toBe("2026-08-04T12:00:00Z");
    });

    // What the socket layer sends when it couldn't get a card from
    // genos-api: the connect-verified id, presence state, and nothing else.
    const bare = {
        userId: "u-bob",
        isOnline: true,
        teamId: THEIR_TEAM,
        customStatus: "in a meeting",
    } as unknown as UserProps;

    it("does not file a nameless row for someone it has never seen", async () => {
        await beat(bare);

        expect(await new UserRepository().getUser("u-bob")).toBeNull();
    });

    it("still takes a nameless beat about someone it knows", async () => {
        const repo = new UserRepository();
        await repo.saveUser(rosterRow);

        await beat(bare);

        const stored = await repo.getUser("u-bob");
        expect(stored?.userName).toBe("Bob");
        expect(stored?.customStatus).toBe("in a meeting");
        expect(stored?.teamId).toBe(MY_TEAM);
    });
});
