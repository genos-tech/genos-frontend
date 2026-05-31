/**
 * IndexedDB data-layer tests against a REAL in-memory IndexedDB
 * (fake-indexeddb/auto). Exercises:
 *   - src/db/repositories/base.ts (BaseRepository CRUD + error paths)
 *   - src/db/repositories/user.ts (UserRepository, incl. teamId index)
 *   - src/db/repositories/checkpoints.ts (CheckpointRepository)
 *   - src/db/services/user.service.ts (UserService business logic)
 *
 * The real `initDB()` (schema-upgrade callback attached) runs unmocked,
 * so the genosData DB is created at DB_VERSION with all v9/v10 stores.
 * We reset to a clean DB before every test via idb's `deleteDB`.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME, STORES } from "../../db/config";
import { BaseRepository } from "../../db/repositories/base";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import { UserRepository } from "../../db/repositories/user";
import { UserService } from "../../db/services/user.service";
import { UserProps } from "../../types/admin";

// The DB's `blocking` handler logs a warning whenever deleteDB forces a
// leaked open connection shut (initDB never closes the connections it
// opens). That's expected teardown noise — silence it for clean output.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

// Fresh, empty genosData DB before every test → full isolation.
beforeEach(async () => {
    await deleteDB(DB_NAME);
});

// ---- helpers ---------------------------------------------------------

function makeUser(overrides: Partial<UserProps> = {}): UserProps {
    return {
        teamId: "team-1",
        teamName: "Team One",
        userId: "u-1",
        userName: "Alice",
        userEmail: "alice@example.test",
        avatarImgPath: "",
        tsLastSeen: "2026-01-01T00:00:00Z",
        tsJoined: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

// A repository pointed at a store that does not exist in the schema.
// Every operation routes through `db.transaction("nonexistentStore", …)`
// (or `db.get`), which throws NotFoundError synchronously inside the
// method's try — exercising each catch branch deterministically.
class BadRepo extends BaseRepository<{ id: string }> {
    constructor() {
        super("nonexistentStore");
    }
}

// Concrete repo bound to a real store (USER_INFO is keyed by "userId"),
// used to exercise the generic BaseRepository surface directly.
class UserStoreRepo extends BaseRepository<UserProps> {
    constructor() {
        super(STORES.USER_INFO);
    }
}

// ---- BaseRepository: happy-path CRUD --------------------------------

describe("BaseRepository CRUD round-trips", () => {
    it("put then get returns the stored item", async () => {
        const repo = new UserStoreRepo();
        const user = makeUser({ userId: "u-put" });

        const putRes = await repo.put(user);
        expect(putRes.success).toBe(true);
        expect(putRes.data).toEqual(user);

        const getRes = await repo.get("u-put");
        expect(getRes.success).toBe(true);
        expect(getRes.data).toEqual(user);
    });

    it("get of a missing key succeeds with undefined data", async () => {
        const repo = new UserStoreRepo();
        const res = await repo.get("does-not-exist");
        expect(res.success).toBe(true);
        expect(res.data).toBeUndefined();
    });

    it("add inserts a new item", async () => {
        const repo = new UserStoreRepo();
        const user = makeUser({ userId: "u-add" });

        const addRes = await repo.add(user);
        expect(addRes.success).toBe(true);
        expect(addRes.data).toEqual(user);

        const getRes = await repo.get("u-add");
        expect(getRes.data).toEqual(user);
    });

    // NOTE: add()'s duplicate-key (ConstraintError) behavior is left
    // WITHOUT an assertion here, and that coverage is genuinely dropped
    // (the BadRepo "add returns success:false" test exercises a
    // different error — NotFoundError — not the add-vs-put ConstraintError
    // contract). Reason: idb's `tx.store.add` rejecting on a duplicate key
    // aborts the underlying transaction, and base.ts's add() never awaits
    // `tx.done` in the failure path, so the aborting transaction's
    // rejection dangles and Vitest reports it as a run-level unhandled
    // rejection. We cannot fix the source or touch config under the test
    // rules, and the rejection is unreachable from test code, so the only
    // way to keep the run clean+deterministic is to not trigger it.

    it("put overwrites an existing item (add-or-update semantics)", async () => {
        const repo = new UserStoreRepo();
        await repo.put(makeUser({ userId: "u-upd", userName: "Old" }));
        await repo.put(makeUser({ userId: "u-upd", userName: "New" }));

        const res = await repo.get("u-upd");
        expect(res.data?.userName).toBe("New");

        const count = await repo.count();
        expect(count.data).toBe(1);
    });

    it("getAll returns every stored item", async () => {
        const repo = new UserStoreRepo();
        await repo.put(makeUser({ userId: "a" }));
        await repo.put(makeUser({ userId: "b" }));
        await repo.put(makeUser({ userId: "c" }));

        const res = await repo.getAll();
        expect(res.success).toBe(true);
        expect(res.data).toHaveLength(3);
        expect((res.data ?? []).map((u) => u.userId).sort()).toEqual(["a", "b", "c"]);
    });

    it("getAll on an empty store returns an empty array", async () => {
        const repo = new UserStoreRepo();
        const res = await repo.getAll();
        expect(res.success).toBe(true);
        expect(res.data).toEqual([]);
    });

    it("delete removes a single item", async () => {
        const repo = new UserStoreRepo();
        await repo.put(makeUser({ userId: "u-del" }));

        const delRes = await repo.delete("u-del");
        expect(delRes.success).toBe(true);
        expect(delRes.data).toBe(true);

        const getRes = await repo.get("u-del");
        expect(getRes.data).toBeUndefined();
    });

    it("delete of a missing key still succeeds (idb no-op)", async () => {
        const repo = new UserStoreRepo();
        const res = await repo.delete("ghost");
        expect(res.success).toBe(true);
        expect(res.data).toBe(true);
    });

    it("clear empties the store", async () => {
        const repo = new UserStoreRepo();
        await repo.put(makeUser({ userId: "x" }));
        await repo.put(makeUser({ userId: "y" }));

        const clearRes = await repo.clear();
        expect(clearRes.success).toBe(true);
        expect(clearRes.data).toBe(true);

        const count = await repo.count();
        expect(count.data).toBe(0);
    });

    it("count reflects the number of stored items", async () => {
        const repo = new UserStoreRepo();
        const empty = await repo.count();
        expect(empty.success).toBe(true);
        expect(empty.data).toBe(0);

        await repo.put(makeUser({ userId: "1" }));
        await repo.put(makeUser({ userId: "2" }));

        const after = await repo.count();
        expect(after.data).toBe(2);
    });

    it("exists is true for a stored key and false for a missing one", async () => {
        const repo = new UserStoreRepo();
        await repo.put(makeUser({ userId: "here" }));

        expect(await repo.exists("here")).toBe(true);
        expect(await repo.exists("nope")).toBe(false);
    });

    it("batchInsert stores all items and reports success", async () => {
        const repo = new UserStoreRepo();
        const items = [
            makeUser({ userId: "b1" }),
            makeUser({ userId: "b2" }),
            makeUser({ userId: "b3" }),
        ];

        const res = await repo.batchInsert(items);
        expect(res.success).toBe(true);
        expect(res.inserted).toBe(3);
        expect(res.errors).toEqual([]);

        const count = await repo.count();
        expect(count.data).toBe(3);
    });

    it("batchInsert with put-semantics upserts duplicate keys without error", async () => {
        const repo = new UserStoreRepo();
        // Same key twice within the batch — batchInsert uses `put`, so the
        // second overwrites rather than failing.
        const res = await repo.batchInsert([
            makeUser({ userId: "same", userName: "First" }),
            makeUser({ userId: "same", userName: "Second" }),
        ]);

        expect(res.success).toBe(true);
        expect(res.inserted).toBe(2);

        const count = await repo.count();
        expect(count.data).toBe(1);
        const got = await repo.get("same");
        expect(got.data?.userName).toBe("Second");
    });
});

// ---- BaseRepository: error/catch branches via a bogus store ---------

describe("BaseRepository error handling (nonexistent store)", () => {
    it("get returns success:false with an error message", async () => {
        const res = await new BadRepo().get("k");
        expect(res.success).toBe(false);
        expect(typeof res.error).toBe("string");
        expect(res.error?.length).toBeGreaterThan(0);
    });

    it("getAll returns success:false", async () => {
        const res = await new BadRepo().getAll();
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("add returns success:false", async () => {
        const res = await new BadRepo().add({ id: "k" });
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("put returns success:false", async () => {
        const res = await new BadRepo().put({ id: "k" });
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("delete returns success:false", async () => {
        const res = await new BadRepo().delete("k");
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("clear returns success:false", async () => {
        const res = await new BadRepo().clear();
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("count returns success:false", async () => {
        const res = await new BadRepo().count();
        expect(res.success).toBe(false);
        expect(res.error).toBeTruthy();
    });

    it("batchInsert hits the outer catch: inserted 0 with one error", async () => {
        const res = await new BadRepo().batchInsert([{ id: "a" }, { id: "b" }]);
        expect(res.success).toBe(false);
        expect(res.inserted).toBe(0);
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0].length).toBeGreaterThan(0);
    });

    it("exists returns false when the underlying get fails", async () => {
        expect(await new BadRepo().exists("k")).toBe(false);
    });
});

// ---- Isolation guarantee --------------------------------------------

describe("DB reset isolation", () => {
    it("seeds a user in this test", async () => {
        const repo = new UserRepository();
        await repo.saveUser(makeUser({ userId: "leak-check" }));
        expect(await repo.userExists("leak-check")).toBe(true);
    });

    it("does NOT see the user seeded by the previous test", async () => {
        const repo = new UserRepository();
        expect(await repo.userExists("leak-check")).toBe(false);
        const count = await repo.count();
        expect(count.data).toBe(0);
    });
});

// ---- UserRepository --------------------------------------------------

describe("UserRepository", () => {
    it("saveUser then getUser round-trips, getUser missing returns null", async () => {
        const repo = new UserRepository();
        const user = makeUser({ userId: "ur-1" });

        expect(await repo.saveUser(user)).toBe(true);
        expect(await repo.getUser("ur-1")).toEqual(user);
        expect(await repo.getUser("missing")).toBeNull();
    });

    it("getAllUsers returns all saved users (and [] when empty)", async () => {
        const repo = new UserRepository();
        expect(await repo.getAllUsers()).toEqual([]);

        await repo.saveUser(makeUser({ userId: "a" }));
        await repo.saveUser(makeUser({ userId: "b" }));
        const all = await repo.getAllUsers();
        expect(all.map((u) => u.userId).sort()).toEqual(["a", "b"]);
    });

    it("deleteUser removes the user", async () => {
        const repo = new UserRepository();
        await repo.saveUser(makeUser({ userId: "del-me" }));
        expect(await repo.deleteUser("del-me")).toBe(true);
        expect(await repo.getUser("del-me")).toBeNull();
    });

    it("userExists reflects presence", async () => {
        const repo = new UserRepository();
        expect(await repo.userExists("ghost")).toBe(false);
        await repo.saveUser(makeUser({ userId: "ghost" }));
        expect(await repo.userExists("ghost")).toBe(true);
    });

    it("getTeamMembers filters by the teamId index", async () => {
        const repo = new UserRepository();
        await repo.saveUser(makeUser({ userId: "t1-a", teamId: "team-A" }));
        await repo.saveUser(makeUser({ userId: "t1-b", teamId: "team-A" }));
        await repo.saveUser(makeUser({ userId: "t2-a", teamId: "team-B" }));

        const teamA = await repo.getTeamMembers("team-A");
        expect(teamA.map((u) => u.userId).sort()).toEqual(["t1-a", "t1-b"]);

        const teamB = await repo.getTeamMembers("team-B");
        expect(teamB.map((u) => u.userId)).toEqual(["t2-a"]);

        const none = await repo.getTeamMembers("team-Z");
        expect(none).toEqual([]);
    });
});

// ---- CheckpointRepository -------------------------------------------

describe("CheckpointRepository", () => {
    it("getCheckpoint returns null when unset", async () => {
        const repo = new CheckpointRepository();
        expect(await repo.getCheckpoint("activity")).toBeNull();
    });

    it("setCheckpoint then getCheckpoint round-trips serverTime", async () => {
        const repo = new CheckpointRepository();
        await repo.setCheckpoint("dm", "2026-05-31T12:00:00Z");
        expect(await repo.getCheckpoint("dm")).toBe("2026-05-31T12:00:00Z");
    });

    it("setCheckpoint overwrites the previous watermark for the same key", async () => {
        const repo = new CheckpointRepository();
        await repo.setCheckpoint("tasks:1", "2026-05-30T00:00:00Z");
        await repo.setCheckpoint("tasks:1", "2026-05-31T00:00:00Z");
        expect(await repo.getCheckpoint("tasks:1")).toBe("2026-05-31T00:00:00Z");
    });

    it("stores a full record with key, serverTime and lastUpdated", async () => {
        const repo = new CheckpointRepository();
        await repo.setCheckpoint("activity", "2026-05-31T09:00:00Z");

        const raw = await repo.get("activity");
        expect(raw.success).toBe(true);
        expect(raw.data?.key).toBe("activity");
        expect(raw.data?.serverTime).toBe("2026-05-31T09:00:00Z");
        // lastUpdated is stamped with an ISO timestamp at write time.
        expect(raw.data?.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("keeps distinct watermarks per key", async () => {
        const repo = new CheckpointRepository();
        await repo.setCheckpoint("dm", "2026-01-01T00:00:00Z");
        await repo.setCheckpoint("activity", "2026-02-02T00:00:00Z");

        expect(await repo.getCheckpoint("dm")).toBe("2026-01-01T00:00:00Z");
        expect(await repo.getCheckpoint("activity")).toBe("2026-02-02T00:00:00Z");
    });
});

// ---- UserService -----------------------------------------------------

describe("UserService", () => {
    it("delegates CRUD to the repository", async () => {
        const svc = new UserService();
        const user = makeUser({ userId: "svc-1", userEmail: "svc1@example.test" });

        expect(await svc.saveUser(user)).toBe(true);
        expect(await svc.getUser("svc-1")).toEqual(user);
        expect(await svc.userExists("svc-1")).toBe(true);

        expect(await svc.deleteUser("svc-1")).toBe(true);
        expect(await svc.getUser("svc-1")).toBeNull();
        expect(await svc.userExists("svc-1")).toBe(false);
    });

    it("getAllUsers and getTeamMembers pass through to the repo", async () => {
        const svc = new UserService();
        await svc.saveUser(makeUser({ userId: "m1", teamId: "T" }));
        await svc.saveUser(makeUser({ userId: "m2", teamId: "T" }));
        await svc.saveUser(makeUser({ userId: "m3", teamId: "Other" }));

        const all = await svc.getAllUsers();
        expect(all).toHaveLength(3);

        const team = await svc.getTeamMembers("T");
        expect(team.map((u) => u.userId).sort()).toEqual(["m1", "m2"]);
    });

    it("getUserByEmail finds by email or returns null", async () => {
        const svc = new UserService();
        await svc.saveUser(makeUser({ userId: "e1", userEmail: "found@example.test" }));

        const found = await svc.getUserByEmail("found@example.test");
        expect(found?.userId).toBe("e1");

        expect(await svc.getUserByEmail("nobody@example.test")).toBeNull();
    });

    it("searchUsersByName is case-insensitive substring match", async () => {
        const svc = new UserService();
        await svc.saveUser(makeUser({ userId: "n1", userName: "Alice Anderson" }));
        await svc.saveUser(makeUser({ userId: "n2", userName: "Bob Brown" }));
        await svc.saveUser(makeUser({ userId: "n3", userName: "Alicia Keys" }));

        const ali = await svc.searchUsersByName("ali");
        expect(ali.map((u) => u.userId).sort()).toEqual(["n1", "n3"]);

        expect(await svc.searchUsersByName("BROWN")).toHaveLength(1);
        expect(await svc.searchUsersByName("zzz")).toEqual([]);
    });

    it("getUsersByIds returns found users and drops missing ones", async () => {
        const svc = new UserService();
        await svc.saveUser(makeUser({ userId: "i1" }));
        await svc.saveUser(makeUser({ userId: "i2" }));

        const result = await svc.getUsersByIds(["i1", "missing", "i2"]);
        expect(result.map((u) => u.userId).sort()).toEqual(["i1", "i2"]);

        expect(await svc.getUsersByIds([])).toEqual([]);
        expect(await svc.getUsersByIds(["none", "gone"])).toEqual([]);
    });
});
