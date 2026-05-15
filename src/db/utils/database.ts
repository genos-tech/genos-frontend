import { openDB } from "idb";

import { DB_NAME, DB_VERSION, STORES } from "../config";

// Stores that hold team-scoped data and must be wiped when the user switches teams.
// USER_INFO is intentionally excluded: it is indexed by teamId and shared across teams
// so it can stay populated for offline access (see loadTeamMembersWorker).
const TEAM_SCOPED_STORES: readonly string[] = [
    STORES.USER_INFO,
    STORES.INBOX,
    STORES.ACTIVITY_MESSAGES,
    STORES.DM_CHATS,
    STORES.DM_MESSAGES,
    STORES.DM_THREAD_MESSAGES,
    STORES.GM_CHATS,
    STORES.GM_MESSAGES,
    STORES.GM_THREAD_MESSAGES,
    STORES.MDM_CHATS,
    STORES.MDM_MESSAGES,
    STORES.MDM_THREAD_MESSAGES,
    STORES.PM_CHATS,
    STORES.PM_MESSAGES,
    STORES.PM_THREAD_MESSAGES,
    STORES.FLAGGED_MESSAGES,
    STORES.TASK_META,
    STORES.TASK_FULL,
    STORES.PERSONAL_NOTES,
    STORES.TASK_NOTES,
    STORES.CHAT_NOTES,
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
            const db = await openDB(DB_NAME, DB_VERSION);
            return db.objectStoreNames.contains(storeName);
        } catch {
            return false;
        }
    }

    // Get store count
    static async getStoreCount(storeName: string): Promise<number> {
        try {
            const db = await openDB(DB_NAME, DB_VERSION);
            const tx = db.transaction(storeName, "readonly");
            return await tx.store.count();
        } catch {
            return 0;
        }
    }

    // Clear all data from a store
    static async clearStore(storeName: string): Promise<boolean> {
        try {
            const db = await openDB(DB_NAME, DB_VERSION);
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
            const db = await openDB(DB_NAME, DB_VERSION);
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

    // Get database size (approximate)
    static async getDatabaseSize(): Promise<number> {
        try {
            const db = await openDB(DB_NAME, DB_VERSION);
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
            const db = await openDB(DB_NAME, DB_VERSION);
            return db !== null;
        } catch {
            return false;
        }
    }

    // Get database version
    static async getDatabaseVersion(): Promise<number> {
        try {
            const db = await openDB(DB_NAME, DB_VERSION);
            return db.version;
        } catch {
            return 0;
        }
    }
}
