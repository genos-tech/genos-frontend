/**
 * Sign-out wipes the local team cache (MIP-809).
 *
 * `useSignOut` cleared localStorage, history, drafts and the private profile,
 * and left IndexedDB for the next sign-in to clear, which it only did when a
 * DIFFERENT person signed in. So a signed-out device kept the last user's whole
 * team cache: the roster with every teammate's email, the inbox, tasks,
 * messages, to-dos and the text of notes (the per-document Yjs databases).
 *
 * `wipeLocalCache` runs against a real in-memory IndexedDB. The hook's order
 * and failure behaviour are in `useSignOutWipe.test.tsx`.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME, initDB, STORES } from "../../db/config";
import { DatabaseUtils } from "../../db/utils/database";

// `initDB` opens a new connection per call, so a failure has to be injected at
// the function, not on one handle. The default is the real thing.
const injected = vi.hoisted(() => ({ failTransactions: false }));
vi.mock("../../db/config", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../db/config")>();
    return {
        ...actual,
        initDB: async () => {
            const db = await actual.initDB();
            if (!injected.failTransactions) return db;
            return new Proxy(db, {
                get(target, prop) {
                    if (prop === "transaction") {
                        return () => {
                            throw new Error("storage unavailable");
                        };
                    }
                    const value = Reflect.get(target, prop);
                    return typeof value === "function" ? value.bind(target) : value;
                },
            });
        },
    };
});

const putRow = async (store: string, row: Record<string, unknown>) => {
    const db = await initDB();
    await db.put(store, row);
};

const count = async (store: string) => (await initDB()).count(store);

const openAndClose = (name: string) =>
    new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(name, 1);
        req.onsuccess = () => {
            req.result.close();
            resolve();
        };
        req.onerror = () => reject(req.error);
    });

const databaseNames = async () => (await indexedDB.databases()).map((d) => d.name);

// One row per store, keyed the way each store is keyed.
const SEED: Array<[string, Record<string, unknown>]> = [
    [STORES.USER_INFO, { userId: "u1", userName: "Bob", userEmail: "bob@example.com" }],
    [STORES.INBOX, { itemId: 1 }],
    [STORES.ACTIVITY_MESSAGES, { activityId: "a1" }],
    [STORES.TASK_META, { id: 1 }],
    [STORES.TASK_FULL, { id: 1 }],
    [STORES.PERSONAL_NOTES, { noteId: 1 }],
    [STORES.TASK_NOTES, { noteId: 1 }],
    [STORES.CHAT_NOTES, { noteId: 1 }],
    [STORES.TODOS, { groupId: 1, userId: "u1", items: [] }],
    [STORES.SYNC_CHECKPOINTS, { key: "tasks:1", serverTime: "t" }],
    [STORES.CHANNELS, { id: "c1" }],
    [STORES.CHANNEL_MEMBERS, { id: "m1" }],
    [STORES.MESSAGES_V3, { id: "msg1" }],
    [STORES.MESSAGE_REACTIONS, { id: "r1" }],
    [STORES.READ_CURSORS, { id: "rc1" }],
    [STORES.PINS, { id: "p1" }],
    [STORES.FLAGS, { id: "f1" }],
    [STORES.MESSAGE_ATTACHMENTS, { id: "at1" }],
];

describe("DatabaseUtils.wipeLocalCache", () => {
    beforeEach(async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        injected.failTransactions = false;
        await deleteDB(DB_NAME);
    });

    it("clears every store, so nothing a person cached outlives the session", async () => {
        for (const [store, row] of SEED) await putRow(store, row);

        const result = await DatabaseUtils.wipeLocalCache();

        expect(result.ok).toBe(true);
        for (const [store] of SEED) {
            expect(await count(store), `${store} should be empty`).toBe(0);
        }
    });

    it("covers every store the schema defines, so a new store cannot slip past", async () => {
        const db = await initDB();
        const defined = Array.from(db.objectStoreNames).sort();
        const seeded = SEED.map(([store]) => store).sort();

        expect(seeded).toEqual(defined);
    });

    it("clears the to-dos and the roster, which a team switch deliberately keeps or never covered", async () => {
        await putRow(STORES.TODOS, { groupId: 7, userId: "u1", items: [{ text: "private" }] });
        await putRow(STORES.USER_INFO, { userId: "u9", userEmail: "x@example.com" });

        await DatabaseUtils.wipeLocalCache();

        expect(await count(STORES.TODOS)).toBe(0);
        expect(await count(STORES.USER_INFO)).toBe(0);
    });

    it("deletes the per-document Yjs databases, where note and task text lives", async () => {
        for (const name of ["task-body:1", "my-note:2", "chat-note:3", "task-note:4"]) {
            await openAndClose(name);
        }

        const result = await DatabaseUtils.wipeLocalCache();

        expect(result.yjsDeleted).toBe(4);
        const names = await databaseNames();
        for (const name of ["task-body:1", "my-note:2", "chat-note:3", "task-note:4"]) {
            expect(names).not.toContain(name);
        }
    });

    it("leaves a database it does not own alone", async () => {
        await openAndClose("someone-elses-db");
        await openAndClose("task-body:1");

        await DatabaseUtils.wipeLocalCache();

        const names = await databaseNames();
        expect(names).toContain("someone-elses-db");
        expect(names).not.toContain("task-body:1");
    });

    it("keeps the database itself, so the next sign-in starts from an empty cache", async () => {
        await putRow(STORES.INBOX, { itemId: 1 });

        await DatabaseUtils.wipeLocalCache();

        expect(await databaseNames()).toContain(DB_NAME);
        // And it is usable straight away.
        await putRow(STORES.INBOX, { itemId: 2 });
        expect(await count(STORES.INBOX)).toBe(1);
    });

    it("is a no-op that succeeds on an already empty cache", async () => {
        const result = await DatabaseUtils.wipeLocalCache();

        expect(result).toEqual({ ok: true, yjsDeleted: 0, yjsLeft: 0 });
    });

    it("does not throw when it cannot clear, and says so", async () => {
        await putRow(STORES.INBOX, { itemId: 1 });
        injected.failTransactions = true;

        const result = await DatabaseUtils.wipeLocalCache();

        expect(result.ok).toBe(false);
        injected.failTransactions = false;
        expect(await count(STORES.INBOX)).toBe(1);
    });

    it("still deletes the Yjs databases when clearing the stores fails", async () => {
        await openAndClose("task-body:1");
        injected.failTransactions = true;

        const result = await DatabaseUtils.wipeLocalCache();

        expect(result.ok).toBe(false);
        expect(result.yjsDeleted).toBe(1);
        expect(await databaseNames()).not.toContain("task-body:1");
    });

    it("degrades quietly where indexedDB.databases() is missing", async () => {
        await putRow(STORES.INBOX, { itemId: 1 });
        const original = (indexedDB as any).databases;
        (indexedDB as any).databases = undefined;
        try {
            const result = await DatabaseUtils.wipeLocalCache();
            expect(result.ok).toBe(true);
            expect(result.yjsDeleted).toBe(0);
            expect(await count(STORES.INBOX)).toBe(0);
        } finally {
            (indexedDB as any).databases = original;
        }
    });
});
