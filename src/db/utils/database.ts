import { openDB } from "idb";

import { DB_NAME, initDB, STORES } from "../config";

// Stores that hold team-scoped data and must be wiped when the user switches teams.
// USER_INFO is intentionally excluded: it is indexed by teamId and shared across teams
// so it can stay populated for offline access (see loadTeamMembersWorker).
const TEAM_SCOPED_STORES: readonly string[] = [
    STORES.USER_INFO,
    STORES.INBOX,
    STORES.ACTIVITY_MESSAGES,
    STORES.TASK_META,
    STORES.TASK_FULL,
    STORES.PERSONAL_NOTES,
    STORES.TASK_NOTES,
    STORES.CHAT_NOTES,
    STORES.SYNC_CHECKPOINTS,
    // v3 unified messaging stores — team-scoped because channels
    // belong to a team; switching teams must clear them.
    STORES.CHANNELS,
    STORES.CHANNEL_MEMBERS,
    STORES.MESSAGES_V3,
    STORES.MESSAGE_REACTIONS,
    STORES.READ_CURSORS,
    STORES.PINS,
    STORES.FLAGS,
    STORES.MESSAGE_ATTACHMENTS,
];

// Database utility functions
export class DatabaseUtils {
    // Get all store names in the database
    static async getAllStores(dbName: string): Promise<string[]> {
        const db = await openDB(dbName);
        return Array.from(db.objectStoreNames);
    }

    // Check if a store exists
    static async storeExists(storeName: string): Promise<boolean> {
        try {
            const db = await initDB();
            return db.objectStoreNames.contains(storeName);
        } catch {
            return false;
        }
    }

    // Get store count
    static async getStoreCount(storeName: string): Promise<number> {
        try {
            const db = await initDB();
            const tx = db.transaction(storeName, "readonly");
            return await tx.store.count();
        } catch {
            return 0;
        }
    }

    // Clear all data from a store
    static async clearStore(storeName: string): Promise<boolean> {
        try {
            const db = await initDB();
            const tx = db.transaction(storeName, "readwrite");
            await tx.store.clear();
            await tx.done;
            return true;
        } catch {
            return false;
        }
    }

    // Clear every team-scoped store in a single transaction.
    // Used when the user switches teams so no stale data leaks across teams.
    static async clearTeamScopedStores(): Promise<boolean> {
        try {
            const db = await initDB();
            const presentStores = TEAM_SCOPED_STORES.filter((name) =>
                db.objectStoreNames.contains(name)
            );
            if (presentStores.length === 0) return true;

            const tx = db.transaction(presentStores, "readwrite");
            await Promise.all(presentStores.map((name) => tx.objectStore(name).clear()));
            await tx.done;
            return true;
        } catch (error) {
            console.error("Failed to clear team-scoped IndexedDB stores:", error);
            return false;
        }
    }

    // Delete the entire database
    static async deleteDatabase(): Promise<boolean> {
        try {
            await new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(DB_NAME);
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
            });
            console.log(`IndexedDB "${DB_NAME}" deleted. Recreating...`);
            return true;
        } catch {
            return false;
        }
    }

    // y-indexeddb creates one IndexedDB database per Yjs document name
    // (`task-body:<id>`, `my-note:<id>`, `chat-note:<id>`, `task-note:<id>`).
    // Wraps the deletion in a promise + try/catch so callers can fire-and-forget
    // without worrying about the request semantics or transient failures.
    static async deleteYjsDatabase(name: string): Promise<boolean> {
        try {
            await new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
                // Browsers fire `blocked` when an open connection holds the
                // DB; we resolve anyway because (a) the open handle will close
                // when its owner unmounts and (b) the next sweep / row-delete
                // will retry.
                req.onblocked = () => resolve();
            });
            return true;
        } catch {
            return false;
        }
    }

    // Sweep orphaned per-document Yjs databases. Enumerates every IDB
    // database the origin owns, filters to ones with a Yjs document prefix,
    // and deletes any whose ID is NOT in the supplied `activeIds` sets.
    // Returns the number of databases deleted.
    //
    // `indexedDB.databases()` is supported in Chrome/Edge/Safari + Firefox
    // 126+. On older Firefox the call throws or returns undefined; we
    // degrade to a no-op rather than hand-rolling a separate enumeration.
    static async sweepOrphanYjsDatabases(activeIds: {
        taskIds: Set<number>;
        myNoteIds: Set<number>;
        chatNoteIds: Set<number>;
        taskNoteIds: Set<number>;
    }): Promise<number> {
        // `indexedDB.databases` is on the global IDBFactory but TS's lib.dom
        // doesn't always have it.
        const databasesFn = (
            indexedDB as IDBFactory & {
                databases?: () => Promise<{ name?: string }[]>;
            }
        ).databases;
        if (typeof databasesFn !== "function") return 0;

        let dbs: { name?: string }[];
        try {
            dbs = await databasesFn.call(indexedDB);
        } catch {
            return 0;
        }

        const prefixes: Array<[string, Set<number>]> = [
            ["task-body:", activeIds.taskIds],
            ["my-note:", activeIds.myNoteIds],
            ["chat-note:", activeIds.chatNoteIds],
            ["task-note:", activeIds.taskNoteIds],
        ];

        let deleted = 0;
        for (const { name } of dbs) {
            if (!name) continue;
            for (const [prefix, alive] of prefixes) {
                if (!name.startsWith(prefix)) continue;
                const idStr = name.slice(prefix.length);
                const id = Number(idStr);
                // Defensive: a non-numeric suffix is an unknown format, leave it
                // alone rather than risk deleting something we don't own.
                if (!Number.isFinite(id)) break;
                if (alive.has(id)) break;
                const ok = await DatabaseUtils.deleteYjsDatabase(name);
                if (ok) deleted += 1;
                break;
            }
        }
        return deleted;
    }

    // Get database size (approximate)
    static async getDatabaseSize(): Promise<number> {
        try {
            const db = await initDB();
            const storeNames = Array.from(db.objectStoreNames);
            let totalSize = 0;

            for (const storeName of storeNames) {
                const tx = db.transaction(storeName, "readonly");
                const count = await tx.store.count();
                totalSize += count;
            }

            return totalSize;
        } catch {
            return 0;
        }
    }

    // Check if database is accessible
    static async isDatabaseAccessible(): Promise<boolean> {
        try {
            const db = await initDB();
            return db !== null;
        } catch {
            return false;
        }
    }

    // Get database version
    static async getDatabaseVersion(): Promise<number> {
        try {
            const db = await initDB();
            return db.version;
        } catch {
            return 0;
        }
    }
}
