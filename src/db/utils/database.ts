import { openDB } from "idb";

import { DB_NAME, DB_VERSION } from "../config";

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
