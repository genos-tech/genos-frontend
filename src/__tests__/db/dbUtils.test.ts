// Real in-memory IndexedDB for the DatabaseUtils block. Must be imported
// before anything that touches `indexedDB` / `idb`.
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME, DB_VERSION, initDB, STORES } from "../../db/config";
import { DatabaseUtils } from "../../db/utils/database";
import { HelperUtils } from "../../db/utils/helpers";
import { ValidationUtils } from "../../db/utils/validation";

// ---------------------------------------------------------------------------
// HelperUtils — pure helpers
// ---------------------------------------------------------------------------
describe("HelperUtils", () => {
    describe("ID generators", () => {
        it("generateMessageIdWithChatId joins chatId_messageId", () => {
            expect(HelperUtils.generateMessageIdWithChatId(12, 99)).toBe("12_99");
        });

        it("generateThreadMessageId joins chatId_threadId_messageId", () => {
            expect(HelperUtils.generateThreadMessageId(1, 2, 3)).toBe("1_2_3");
        });

        it("generateFlaggedMessageId prefixes flagged_ with chatId then messageId", () => {
            expect(HelperUtils.generateFlaggedMessageId("abc", 7)).toBe("flagged_7_abc");
        });

        it("generateActivityMessageId prefixes activity_ with type and timestamp", () => {
            expect(HelperUtils.generateActivityMessageId("mention", 1000)).toBe(
                "activity_mention_1000"
            );
        });

        it("generateInboxItemId prefixes inbox_ with type and timestamp", () => {
            expect(HelperUtils.generateInboxItemId("dm", 2000)).toBe("inbox_dm_2000");
        });

        it("generateRandomId returns a base36 string", () => {
            const id = HelperUtils.generateRandomId();
            expect(typeof id).toBe("string");
            expect(id).toMatch(/^[0-9a-z]+$/);
            // substr(2, 9) → at most 9 chars
            expect(id.length).toBeLessThanOrEqual(9);
        });

        it("generateUUID returns a v4-shaped UUID", () => {
            const uuid = HelperUtils.generateUUID();
            expect(uuid).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it("generateUUID produces distinct values across calls", () => {
            expect(HelperUtils.generateUUID()).not.toBe(HelperUtils.generateUUID());
        });
    });

    describe("sorting", () => {
        it("sortMessagesByTimestamp orders ascending", () => {
            const input = [{ timestamp: 30 }, { timestamp: 10 }, { timestamp: 20 }];
            const result = HelperUtils.sortMessagesByTimestamp(input);
            expect(result.map((m) => m.timestamp)).toEqual([10, 20, 30]);
        });

        it("sortMessagesByTimestampDesc orders descending", () => {
            const input = [{ timestamp: 10 }, { timestamp: 30 }, { timestamp: 20 }];
            const result = HelperUtils.sortMessagesByTimestampDesc(input);
            expect(result.map((m) => m.timestamp)).toEqual([30, 20, 10]);
        });

        it("sort handles empty array", () => {
            expect(HelperUtils.sortMessagesByTimestamp([])).toEqual([]);
            expect(HelperUtils.sortMessagesByTimestampDesc([])).toEqual([]);
        });

        it("sort mutates the input array in place (documenting behavior)", () => {
            const input = [{ timestamp: 2 }, { timestamp: 1 }];
            const result = HelperUtils.sortMessagesByTimestamp(input);
            expect(result).toBe(input); // same reference
            expect(input.map((m) => m.timestamp)).toEqual([1, 2]);
        });
    });

    describe("getLatestMessage / getOldestMessage", () => {
        it("returns null for empty arrays", () => {
            expect(HelperUtils.getLatestMessage([])).toBeNull();
            expect(HelperUtils.getOldestMessage([])).toBeNull();
        });

        it("getLatestMessage returns the highest-timestamp message", () => {
            const msgs = [{ timestamp: 5 }, { timestamp: 50 }, { timestamp: 25 }];
            expect(HelperUtils.getLatestMessage(msgs)).toEqual({ timestamp: 50 });
        });

        it("getOldestMessage returns the lowest-timestamp message", () => {
            const msgs = [{ timestamp: 5 }, { timestamp: 50 }, { timestamp: 25 }];
            expect(HelperUtils.getOldestMessage(msgs)).toEqual({ timestamp: 5 });
        });

        it("single-element arrays return that element", () => {
            const one = [{ timestamp: 7 }];
            expect(HelperUtils.getLatestMessage(one)).toEqual({ timestamp: 7 });
            expect(HelperUtils.getOldestMessage(one)).toEqual({ timestamp: 7 });
        });
    });

    describe("filterMessagesByDateRange", () => {
        const msgs = [{ timestamp: 10 }, { timestamp: 20 }, { timestamp: 30 }, { timestamp: 40 }];

        it("includes messages within the inclusive range", () => {
            const result = HelperUtils.filterMessagesByDateRange(msgs, 20, 30);
            expect(result.map((m) => m.timestamp)).toEqual([20, 30]);
        });

        it("boundaries are inclusive", () => {
            const result = HelperUtils.filterMessagesByDateRange(msgs, 10, 40);
            expect(result).toHaveLength(4);
        });

        it("returns empty when nothing falls in range", () => {
            expect(HelperUtils.filterMessagesByDateRange(msgs, 100, 200)).toEqual([]);
        });
    });

    describe("paginateMessages", () => {
        const items = [1, 2, 3, 4, 5, 6, 7];

        it("returns the requested page slice", () => {
            expect(HelperUtils.paginateMessages(items, 1, 3)).toEqual([1, 2, 3]);
            expect(HelperUtils.paginateMessages(items, 2, 3)).toEqual([4, 5, 6]);
            expect(HelperUtils.paginateMessages(items, 3, 3)).toEqual([7]);
        });

        it("returns empty for pages beyond the data", () => {
            expect(HelperUtils.paginateMessages(items, 4, 3)).toEqual([]);
        });

        it("page=0 produces a negative startIndex → slice from end (documenting behavior)", () => {
            // startIndex = (0-1)*3 = -3 ; endIndex = 0 → slice(-3, 0) === []
            expect(HelperUtils.paginateMessages(items, 0, 3)).toEqual([]);
        });
    });

    describe("getTotalPages", () => {
        it("rounds up partial pages", () => {
            expect(HelperUtils.getTotalPages(10, 3)).toBe(4);
            expect(HelperUtils.getTotalPages(9, 3)).toBe(3);
            expect(HelperUtils.getTotalPages(0, 3)).toBe(0);
        });

        it("pageSize=0 yields Infinity (documenting divide-by-zero behavior)", () => {
            expect(HelperUtils.getTotalPages(5, 0)).toBe(Infinity);
        });
    });

    describe("formatTimestamp", () => {
        it("returns a non-empty string (locale/TZ dependent)", () => {
            const result = HelperUtils.formatTimestamp(Date.UTC(2025, 5, 15, 10, 30, 0));
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("getRelativeTime", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        const now = () => Date.now();

        it("returns 'Just now' for sub-minute differences", () => {
            expect(HelperUtils.getRelativeTime(now() - 5_000)).toBe("Just now");
        });

        it("returns singular minute", () => {
            expect(HelperUtils.getRelativeTime(now() - 60_000)).toBe("1 minute ago");
        });

        it("returns plural minutes", () => {
            expect(HelperUtils.getRelativeTime(now() - 5 * 60_000)).toBe("5 minutes ago");
        });

        it("returns singular hour", () => {
            expect(HelperUtils.getRelativeTime(now() - 60 * 60_000)).toBe("1 hour ago");
        });

        it("returns plural hours", () => {
            expect(HelperUtils.getRelativeTime(now() - 3 * 60 * 60_000)).toBe("3 hours ago");
        });

        it("returns singular day", () => {
            expect(HelperUtils.getRelativeTime(now() - 24 * 60 * 60_000)).toBe("1 day ago");
        });

        it("returns plural days", () => {
            expect(HelperUtils.getRelativeTime(now() - 2 * 24 * 60 * 60_000)).toBe("2 days ago");
        });
    });

    describe("debounce", () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it("invokes once after the wait, only with the last args", () => {
            const fn = vi.fn();
            const debounced = HelperUtils.debounce(fn, 100);
            debounced("a");
            debounced("b");
            debounced("c");
            expect(fn).not.toHaveBeenCalled();
            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith("c");
        });

        it("does not fire before the wait elapses", () => {
            const fn = vi.fn();
            const debounced = HelperUtils.debounce(fn, 100);
            debounced();
            vi.advanceTimersByTime(99);
            expect(fn).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe("throttle", () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it("invokes immediately, then suppresses until the limit elapses", () => {
            const fn = vi.fn();
            const throttled = HelperUtils.throttle(fn, 100);
            throttled("first");
            throttled("second");
            throttled("third");
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith("first");

            vi.advanceTimersByTime(100);
            throttled("fourth");
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith("fourth");
        });
    });

    describe("deepClone", () => {
        it("clones nested structures by value", () => {
            const original = { a: 1, b: { c: [1, 2, 3] } };
            const clone = HelperUtils.deepClone(original);
            expect(clone).toEqual(original);
            expect(clone).not.toBe(original);
            expect(clone.b).not.toBe(original.b);
            clone.b.c.push(4);
            expect(original.b.c).toEqual([1, 2, 3]);
        });
    });

    describe("isEmpty", () => {
        it("returns true for an empty object", () => {
            expect(HelperUtils.isEmpty({})).toBe(true);
        });

        it("returns false for a non-empty object", () => {
            expect(HelperUtils.isEmpty({ a: 1 })).toBe(false);
        });

        it("throws on null (Object.keys(null))", () => {
            expect(() => HelperUtils.isEmpty(null)).toThrow();
        });
    });

    describe("calculateSimilarity", () => {
        it("identical strings return 1.0", () => {
            expect(HelperUtils.calculateSimilarity("hello", "hello")).toBe(1.0);
        });

        it("both empty strings return 1.0", () => {
            expect(HelperUtils.calculateSimilarity("", "")).toBe(1.0);
        });

        it("completely different strings of equal length return 0", () => {
            expect(HelperUtils.calculateSimilarity("abc", "xyz")).toBe(0);
        });

        it("partial overlap returns a value between 0 and 1", () => {
            const score = HelperUtils.calculateSimilarity("kitten", "sitting");
            // levenshtein("kitten","sitting") = 3 ; longer.length = 7 → (7-3)/7
            expect(score).toBeCloseTo((7 - 3) / 7, 5);
        });
    });
});

// ---------------------------------------------------------------------------
// ValidationUtils — type guards / sanitizers
// ---------------------------------------------------------------------------
describe("ValidationUtils", () => {
    describe("isValidChat", () => {
        const valid = { chatId: 1, name: "General", type: "gm", participants: [] };

        it("accepts a well-formed chat", () => {
            expect(ValidationUtils.isValidChat(valid)).toBe(true);
        });

        it("accepts all allowed types", () => {
            for (const type of ["dm", "gm", "pm"]) {
                expect(ValidationUtils.isValidChat({ ...valid, type })).toBe(true);
            }
        });

        it("rejects an unknown type", () => {
            expect(ValidationUtils.isValidChat({ ...valid, type: "mdm" })).toBe(false);
        });

        it("rejects non-number chatId", () => {
            expect(ValidationUtils.isValidChat({ ...valid, chatId: "1" })).toBe(false);
        });

        it("rejects non-array participants", () => {
            expect(ValidationUtils.isValidChat({ ...valid, participants: {} })).toBe(false);
        });

        it("rejects null / undefined", () => {
            expect(ValidationUtils.isValidChat(null)).toBeFalsy();
            expect(ValidationUtils.isValidChat(undefined)).toBeFalsy();
        });
    });

    describe("isValidChatMessage", () => {
        const valid = {
            messageIdWithChatId: "1_2",
            chatId: 1,
            messageId: 2,
            content: "hi",
            timestamp: 1000,
            userId: "u1",
        };

        it("accepts a well-formed message", () => {
            expect(ValidationUtils.isValidChatMessage(valid)).toBe(true);
        });

        it("rejects when content is missing", () => {
            const { content, ...rest } = valid;
            void content;
            expect(ValidationUtils.isValidChatMessage(rest)).toBe(false);
        });

        it("rejects when timestamp is the wrong type", () => {
            expect(ValidationUtils.isValidChatMessage({ ...valid, timestamp: "1000" })).toBe(
                false
            );
        });

        it("rejects null", () => {
            expect(ValidationUtils.isValidChatMessage(null)).toBeFalsy();
        });
    });

    describe("isValidThreadMessage", () => {
        const valid = {
            messageIdWithChatIdAndThreadId: "1_2_3",
            chatId: 1,
            threadId: 2,
            messageId: 3,
            content: "reply",
            timestamp: 1000,
            userId: "u1",
        };

        it("accepts a well-formed thread message", () => {
            expect(ValidationUtils.isValidThreadMessage(valid)).toBe(true);
        });

        it("rejects when threadId is missing", () => {
            const { threadId, ...rest } = valid;
            void threadId;
            expect(ValidationUtils.isValidThreadMessage(rest)).toBe(false);
        });

        it("rejects null", () => {
            expect(ValidationUtils.isValidThreadMessage(null)).toBeFalsy();
        });
    });

    describe("isValidUser", () => {
        const valid = { userId: "u1", userName: "Alice", teamId: "t1" };

        it("accepts a well-formed user", () => {
            expect(ValidationUtils.isValidUser(valid)).toBe(true);
        });

        it("rejects when teamId is the wrong type", () => {
            expect(ValidationUtils.isValidUser({ ...valid, teamId: 5 })).toBe(false);
        });

        it("rejects null", () => {
            expect(ValidationUtils.isValidUser(null)).toBeFalsy();
        });
    });

    describe("isValidTask", () => {
        const valid = {
            id: 1,
            projectId: 2,
            title: "Task",
            status: "open",
            createdAt: 100,
            updatedAt: 200,
        };

        it("accepts a well-formed task", () => {
            expect(ValidationUtils.isValidTask(valid)).toBe(true);
        });

        it("rejects when createdAt is missing", () => {
            const { createdAt, ...rest } = valid;
            void createdAt;
            expect(ValidationUtils.isValidTask(rest)).toBe(false);
        });

        it("rejects null", () => {
            expect(ValidationUtils.isValidTask(null)).toBeFalsy();
        });
    });

    describe("isValidNote", () => {
        const valid = {
            noteId: 1,
            title: "Note",
            content: "body",
            type: "personal",
            createdAt: 100,
            updatedAt: 200,
            userId: "u1",
        };

        it("accepts each allowed note type", () => {
            for (const type of ["personal", "task", "chat"]) {
                expect(ValidationUtils.isValidNote({ ...valid, type })).toBe(true);
            }
        });

        it("rejects an unknown note type", () => {
            expect(ValidationUtils.isValidNote({ ...valid, type: "other" })).toBe(false);
        });

        it("rejects null", () => {
            expect(ValidationUtils.isValidNote(null)).toBeFalsy();
        });
    });

    describe("id / primitive validators", () => {
        it("isValidChatId requires a positive number", () => {
            expect(ValidationUtils.isValidChatId(1)).toBe(true);
            expect(ValidationUtils.isValidChatId(0)).toBe(false);
            expect(ValidationUtils.isValidChatId(-1)).toBe(false);
            expect(ValidationUtils.isValidChatId("1")).toBe(false);
        });

        it("isValidUserId requires a non-empty string", () => {
            expect(ValidationUtils.isValidUserId("u1")).toBe(true);
            expect(ValidationUtils.isValidUserId("")).toBe(false);
            expect(ValidationUtils.isValidUserId(5)).toBe(false);
        });

        it("isValidTaskId requires a positive number", () => {
            expect(ValidationUtils.isValidTaskId(3)).toBe(true);
            expect(ValidationUtils.isValidTaskId(0)).toBe(false);
        });

        it("isValidNoteId requires a positive number", () => {
            expect(ValidationUtils.isValidNoteId(3)).toBe(true);
            expect(ValidationUtils.isValidNoteId(-2)).toBe(false);
        });

        it("isValidProjectId requires a positive number", () => {
            expect(ValidationUtils.isValidProjectId(3)).toBe(true);
            expect(ValidationUtils.isValidProjectId(0)).toBe(false);
        });

        it("isValidTeamId requires a non-empty string", () => {
            expect(ValidationUtils.isValidTeamId("t1")).toBe(true);
            expect(ValidationUtils.isValidTeamId("")).toBe(false);
            expect(ValidationUtils.isValidTeamId(5)).toBe(false);
        });

        it("isValidTimestamp requires a positive number", () => {
            expect(ValidationUtils.isValidTimestamp(1)).toBe(true);
            expect(ValidationUtils.isValidTimestamp(0)).toBe(false);
            expect(ValidationUtils.isValidTimestamp("1")).toBe(false);
        });
    });

    describe("isValidEmail", () => {
        it("accepts a normal email", () => {
            expect(ValidationUtils.isValidEmail("user@example.com")).toBe(true);
        });

        it("rejects strings missing an @ or domain dot", () => {
            expect(ValidationUtils.isValidEmail("userexample.com")).toBe(false);
            expect(ValidationUtils.isValidEmail("user@example")).toBe(false);
            expect(ValidationUtils.isValidEmail("")).toBe(false);
        });

        it("rejects strings with whitespace", () => {
            expect(ValidationUtils.isValidEmail("user @example.com")).toBe(false);
        });
    });

    describe("sanitizeString", () => {
        it("trims surrounding whitespace", () => {
            expect(ValidationUtils.sanitizeString("  hi  ")).toBe("hi");
        });

        it("strips angle brackets", () => {
            expect(ValidationUtils.sanitizeString("<script>alert</script>")).toBe(
                "scriptalert/script"
            );
        });

        it("leaves a clean string unchanged", () => {
            expect(ValidationUtils.sanitizeString("hello world")).toBe("hello world");
        });
    });

    describe("validateArray", () => {
        it("keeps only items passing the validator", () => {
            const items = [1, "two", 3, null, 4];
            const isNumber = (x: any): x is number => typeof x === "number";
            expect(ValidationUtils.validateArray(items, isNumber)).toEqual([1, 3, 4]);
        });

        it("returns empty when nothing passes", () => {
            const isNumber = (x: any): x is number => typeof x === "number";
            expect(ValidationUtils.validateArray(["a", "b"], isNumber)).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// DatabaseUtils — exercises the real fake-indexeddb instance
// ---------------------------------------------------------------------------
describe("DatabaseUtils", () => {
    // Reset the entire fake-indexeddb factory per test. This wipes any
    // connections leaked by methods that open without self-closing handlers
    // (e.g. getAllStores' raw openDB), plus any leftover per-document Yjs
    // DBs from the sweep tests — giving each test a pristine, empty origin.
    beforeEach(async () => {
        globalThis.indexedDB = new IDBFactory();
        await initDB();
    });

    describe("getAllStores", () => {
        it("returns every store declared in the schema", async () => {
            const stores = await DatabaseUtils.getAllStores(DB_NAME);
            expect(stores).toContain(STORES.USER_INFO);
            expect(stores).toContain(STORES.MESSAGES_V3);
            expect(stores).toContain(STORES.CHANNELS);
            expect(stores).toContain(STORES.TODOS);
        });
    });

    describe("storeExists", () => {
        it("returns true for a declared store", async () => {
            expect(await DatabaseUtils.storeExists(STORES.CHANNELS)).toBe(true);
        });

        it("returns false for an unknown store", async () => {
            expect(await DatabaseUtils.storeExists("definitelyNotAStore")).toBe(false);
        });
    });

    describe("getStoreCount", () => {
        it("returns 0 for an empty store", async () => {
            expect(await DatabaseUtils.getStoreCount(STORES.CHANNELS)).toBe(0);
        });

        it("reflects inserted rows", async () => {
            const db = await initDB();
            await db.put(STORES.CHANNELS, { id: "c-1", kind: "gm" });
            await db.put(STORES.CHANNELS, { id: "c-2", kind: "gm" });
            expect(await DatabaseUtils.getStoreCount(STORES.CHANNELS)).toBe(2);
        });

        it("returns 0 (catch branch) for a non-existent store", async () => {
            expect(await DatabaseUtils.getStoreCount("nope")).toBe(0);
        });
    });

    describe("clearStore", () => {
        it("empties a populated store and returns true", async () => {
            const db = await initDB();
            await db.put(STORES.CHANNELS, { id: "c-1", kind: "gm" });
            expect(await DatabaseUtils.getStoreCount(STORES.CHANNELS)).toBe(1);

            const ok = await DatabaseUtils.clearStore(STORES.CHANNELS);
            expect(ok).toBe(true);
            expect(await DatabaseUtils.getStoreCount(STORES.CHANNELS)).toBe(0);
        });

        it("returns false (catch branch) for a non-existent store", async () => {
            expect(await DatabaseUtils.clearStore("nope")).toBe(false);
        });
    });

    describe("clearTeamScopedStores", () => {
        it("clears team-scoped stores while leaving non-scoped stores intact", async () => {
            const db = await initDB();
            // Team-scoped: should be wiped.
            await db.put(STORES.CHANNELS, { id: "c-1", kind: "gm" });
            await db.put(STORES.MESSAGES_V3, {
                id: "m-1",
                channelId: "c-1",
                seq: 1,
                taskKey: "none",
            });
            // NOT team-scoped (TODOS): should survive.
            await db.put(STORES.TODOS, { groupId: "g-1", userId: "u-1" });

            const ok = await DatabaseUtils.clearTeamScopedStores();
            expect(ok).toBe(true);
            expect(await DatabaseUtils.getStoreCount(STORES.CHANNELS)).toBe(0);
            expect(await DatabaseUtils.getStoreCount(STORES.MESSAGES_V3)).toBe(0);
            expect(await DatabaseUtils.getStoreCount(STORES.TODOS)).toBe(1);
        });

        it("returns true even when stores are already empty", async () => {
            expect(await DatabaseUtils.clearTeamScopedStores()).toBe(true);
        });
    });

    describe("getDatabaseSize", () => {
        it("returns the total row count across all stores", async () => {
            const db = await initDB();
            await db.put(STORES.CHANNELS, { id: "c-1", kind: "gm" });
            await db.put(STORES.TODOS, { groupId: "g-1", userId: "u-1" });
            expect(await DatabaseUtils.getDatabaseSize()).toBe(2);
        });

        it("returns 0 for an empty database", async () => {
            expect(await DatabaseUtils.getDatabaseSize()).toBe(0);
        });
    });

    describe("isDatabaseAccessible", () => {
        it("returns true when the DB opens", async () => {
            expect(await DatabaseUtils.isDatabaseAccessible()).toBe(true);
        });
    });

    describe("getDatabaseVersion", () => {
        it("returns the configured schema version", async () => {
            expect(await DatabaseUtils.getDatabaseVersion()).toBe(DB_VERSION);
        });
    });

    describe("deleteYjsDatabase", () => {
        it("resolves true when deleting a fresh per-doc DB", async () => {
            // Create a standalone Yjs-style DB, then delete it.
            await new Promise<void>((resolve, reject) => {
                const req = indexedDB.open("task-body:777", 1);
                req.onsuccess = () => {
                    req.result.close();
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });
            expect(await DatabaseUtils.deleteYjsDatabase("task-body:777")).toBe(true);
        });

        it("resolves true even for a name that doesn't exist", async () => {
            expect(await DatabaseUtils.deleteYjsDatabase("does-not-exist:1")).toBe(true);
        });
    });

    describe("sweepOrphanYjsDatabases", () => {
        const openAndClose = (name: string) =>
            new Promise<void>((resolve, reject) => {
                const req = indexedDB.open(name, 1);
                req.onsuccess = () => {
                    req.result.close();
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });

        it("deletes orphaned per-doc DBs and keeps active ones", async () => {
            await openAndClose("task-body:1"); // active → keep
            await openAndClose("task-body:2"); // orphan → delete
            await openAndClose("my-note:10"); // orphan → delete
            await openAndClose("chat-note:20"); // active → keep

            const deleted = await DatabaseUtils.sweepOrphanYjsDatabases({
                taskIds: new Set([1]),
                myNoteIds: new Set<number>(),
                chatNoteIds: new Set([20]),
                taskNoteIds: new Set<number>(),
            });
            expect(deleted).toBe(2);

            const remaining = (await indexedDB.databases()).map((d) => d.name);
            expect(remaining).toContain("task-body:1");
            expect(remaining).toContain("chat-note:20");
            expect(remaining).not.toContain("task-body:2");
            expect(remaining).not.toContain("my-note:10");
        });

        it("ignores DBs with non-numeric suffixes and unknown prefixes", async () => {
            await openAndClose("task-body:abc"); // non-numeric suffix → leave alone
            await openAndClose("unrelated-db"); // unknown prefix → leave alone

            const deleted = await DatabaseUtils.sweepOrphanYjsDatabases({
                taskIds: new Set<number>(),
                myNoteIds: new Set<number>(),
                chatNoteIds: new Set<number>(),
                taskNoteIds: new Set<number>(),
            });
            expect(deleted).toBe(0);

            const remaining = (await indexedDB.databases()).map((d) => d.name);
            expect(remaining).toContain("task-body:abc");
            expect(remaining).toContain("unrelated-db");
        });

        it("returns 0 when indexedDB.databases is unavailable (degraded path)", async () => {
            const original = (indexedDB as any).databases;
            (indexedDB as any).databases = undefined;
            try {
                const deleted = await DatabaseUtils.sweepOrphanYjsDatabases({
                    taskIds: new Set<number>(),
                    myNoteIds: new Set<number>(),
                    chatNoteIds: new Set<number>(),
                    taskNoteIds: new Set<number>(),
                });
                expect(deleted).toBe(0);
            } finally {
                (indexedDB as any).databases = original;
            }
        });

        it("returns 0 when databases() throws", async () => {
            const original = (indexedDB as any).databases;
            (indexedDB as any).databases = vi.fn().mockRejectedValue(new Error("boom"));
            try {
                const deleted = await DatabaseUtils.sweepOrphanYjsDatabases({
                    taskIds: new Set<number>(),
                    myNoteIds: new Set<number>(),
                    chatNoteIds: new Set<number>(),
                    taskNoteIds: new Set<number>(),
                });
                expect(deleted).toBe(0);
            } finally {
                (indexedDB as any).databases = original;
            }
        });
    });

    describe("deleteDatabase", () => {
        it("resolves true on a healthy delete", async () => {
            // Note: leaves the main DB deleted; subsequent tests re-create
            // it via the beforeEach initDB(). Run last by placement.
            const ok = await DatabaseUtils.deleteDatabase();
            expect(ok).toBe(true);
        });
    });
});
