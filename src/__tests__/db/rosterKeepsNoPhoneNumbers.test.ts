/**
 * The roster does not store teammates' phone numbers (MIP-768).
 *
 * The roster lives in IndexedDB, which outlives sign-out until the next user
 * switch, so on a shared or lost device it would hold the whole team's phone
 * numbers. The profile card does not need them stored: opening it re-fetches
 * the member (`getTeamMemberInfo`, which carries the phone) and overlays it.
 *
 * The strip is at the repository boundary, so every write path is covered, and
 * rows written before this change are swept. The email is deliberately NOT
 * stripped here: 61 files read it, several as an identity key.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { UserRepository, withoutStoredPhone } from "../../db/repositories/user";
import { usersHandlers } from "../../db/workers/handlers/users.handlers";
import type { UserProps } from "../../types/admin";

vi.mock("../../features/admin/services/loadTeamMembers", () => ({
    loadTeamMembers: vi.fn(async () => ({ serverTime: "t", members: [], forceFull: false })),
}));

const person = (id: string, over: Partial<UserProps> = {}): UserProps =>
    ({
        teamId: "team-a",
        teamName: "Team A",
        userId: id,
        userName: `name ${id}`,
        userEmail: `${id}@example.com`,
        avatarImgPath: "",
        tsLastSeen: "",
        tsJoined: "2026-01-01",
        phoneNumber: "+81-90-0000-0000",
        ...over,
    }) as UserProps;

const phones = async () => {
    const all = await new UserRepository().getAllUsers();
    return all.map((u) => [u.userId, u.phoneNumber]);
};

describe("withoutStoredPhone", () => {
    it("removes the phone and nothing else", () => {
        const user = person("u1", { customStatus: "away", timezone: "Asia/Tokyo" });
        const expected = { ...user };
        delete expected.phoneNumber;

        const out = withoutStoredPhone(user);

        expect("phoneNumber" in out).toBe(false);
        expect(out).toEqual(expected);
    });

    it("keeps the email", () => {
        expect(withoutStoredPhone(person("u1")).userEmail).toBe("u1@example.com");
    });

    it("does not mutate its argument", () => {
        const user = person("u1");

        withoutStoredPhone(user);

        expect(user.phoneNumber).toBe("+81-90-0000-0000");
    });

    it("returns a row with no phone as it is", () => {
        const user = person("u1");
        delete user.phoneNumber;

        expect(withoutStoredPhone(user)).toBe(user);
    });
});

describe("every write path into the roster drops the phone", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("saveUser", async () => {
        await new UserRepository().saveUser(person("u1"));

        expect(await phones()).toEqual([["u1", undefined]]);
    });

    it("put", async () => {
        await new UserRepository().put(person("u1"));

        expect(await phones()).toEqual([["u1", undefined]]);
    });

    it("add", async () => {
        await new UserRepository().add(person("u1"));

        expect(await phones()).toEqual([["u1", undefined]]);
    });

    it("batchInsert", async () => {
        const result = await new UserRepository().batchInsert([person("u1"), person("u2")]);

        expect(result.inserted).toBe(2);
        expect((await phones()).every(([, phone]) => phone === undefined)).toBe(true);
    });

    it("the roster loader's applier", async () => {
        const { loadTeamMembers } = await import("../../features/admin/services/loadTeamMembers");
        vi.mocked(loadTeamMembers).mockResolvedValueOnce({
            serverTime: "t",
            members: [person("u1"), person("u2")],
            forceFull: false,
        } as never);

        await usersHandlers.loadTeamMembers({
            myself: person("me", { teamId: "team-a" }),
            accessToken: "tok",
        } as never);

        expect((await phones()).every(([, phone]) => phone === undefined)).toBe(true);
        expect((await phones()).length).toBeGreaterThanOrEqual(2);
    });

    it("a presence beat", async () => {
        await usersHandlers.addUser({ user: person("u1") } as never);

        expect(await phones()).toEqual([["u1", undefined]]);
    });

    it("the email survives every one of them", async () => {
        const repo = new UserRepository();
        await repo.saveUser(person("u1"));
        await repo.batchInsert([person("u2")]);

        const emails = (await repo.getAllUsers()).map((u) => u.userEmail).sort();

        expect(emails).toEqual(["u1@example.com", "u2@example.com"]);
    });
});

describe("rows written before this change are swept", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    // Write a row the way the OLD code did: around the repository's strip.
    const writeOld = async (user: UserProps) => {
        const { BaseRepository } = await import("../../db/repositories/base");
        await BaseRepository.prototype.put.call(new UserRepository(), user);
    };

    it("stripStoredPhones removes the phone from existing rows and reports how many", async () => {
        await writeOld(person("u1"));
        await writeOld(person("u2"));
        await writeOld(person("u3", { phoneNumber: undefined }));
        expect((await phones()).filter(([, p]) => p).length).toBe(2);

        const swept = await new UserRepository().stripStoredPhones();

        expect(swept).toBe(2);
        expect((await phones()).every(([, phone]) => phone === undefined)).toBe(true);
    });

    it("leaves every other field of a swept row alone", async () => {
        await writeOld(person("u1", { customStatus: "in a meeting", timezone: "Asia/Tokyo" }));

        await new UserRepository().stripStoredPhones();

        const row = await new UserRepository().getUser("u1");
        expect(row?.userEmail).toBe("u1@example.com");
        expect(row?.customStatus).toBe("in a meeting");
        expect(row?.timezone).toBe("Asia/Tokyo");
        expect(row?.teamId).toBe("team-a");
    });

    it("is a no-op, writing nothing, once there is nothing to sweep", async () => {
        await new UserRepository().saveUser(person("u1"));

        expect(await new UserRepository().stripStoredPhones()).toBe(0);
    });

    it("runs when the roster loads, before the network, so a failed sync still cleans up", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await writeOld(person("u1"));
        const { loadTeamMembers } = await import("../../features/admin/services/loadTeamMembers");
        vi.mocked(loadTeamMembers).mockResolvedValueOnce(undefined as never);

        await expect(
            usersHandlers.loadTeamMembers({
                myself: person("me"),
                accessToken: "tok",
            } as never)
        ).rejects.toThrow();

        expect(await phones()).toEqual([["u1", undefined]]);
    });
});
