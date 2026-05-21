import { IDBPDatabase } from "idb";

import { DB_NAME, DB_VERSION, initDB } from "../config";
import { BatchOperationResult, OperationResult } from "../types";

// Base repository class with common database operations
export abstract class BaseRepository<T> {
    protected dbName: string;
    protected dbVersion: number;
    protected storeName: string;

    constructor(storeName: string) {
        this.dbName = DB_NAME;
        this.dbVersion = DB_VERSION;
        this.storeName = storeName;
    }

    // Get database connection.
    //
    // Routed through `initDB()` so the schema-upgrade callback is always
    // attached. A bare `openDB(name, version)` with no `upgrade` is
    // catastrophic when the database doesn't exist yet (or sits at a
    // lower version): the browser creates / bumps the DB at the target
    // version *without any object stores*, and every subsequent
    // `openDB(name, version)` sees the version match and skips its own
    // upgrade callback — the malformed DB then persists forever. Any
    // repo write happening before `useAppInitialization`'s pre-warm
    // `initDB()` resolved used to race this way; now every entry point
    // is equivalent.
    protected async getDB(): Promise<IDBPDatabase> {
        return initDB();
    }

    // Get single item by key
    async get(key: IDBValidKey): Promise<OperationResult<T>> {
        try {
            const db = await this.getDB();
            const data = await db.get(this.storeName, key);
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Get all items
    async getAll(): Promise<OperationResult<T[]>> {
        try {
            const db = await this.getDB();
            const data = await db.getAll(this.storeName);
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Add single item
    async add(item: T): Promise<OperationResult<T>> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");
            await tx.store.add(item);
            await tx.done;
            return { success: true, data: item };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Put single item (add or update)
    async put(item: T): Promise<OperationResult<T>> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");
            await tx.store.put(item);
            await tx.done;
            return { success: true, data: item };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Delete single item
    async delete(key: IDBValidKey): Promise<OperationResult<boolean>> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");
            await tx.store.delete(key);
            await tx.done;
            return { success: true, data: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Clear all items in store
    async clear(): Promise<OperationResult<boolean>> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");
            await tx.store.clear();
            await tx.done;
            return { success: true, data: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    // Batch insert items
    async batchInsert(items: T[]): Promise<BatchOperationResult> {
        const errors: string[] = [];
        let inserted = 0;

        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");

            for (const item of items) {
                try {
                    await tx.store.put(item);
                    inserted++;
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : "Unknown error");
                }
            }

            await tx.done;
            return { success: errors.length === 0, inserted, errors };
        } catch (error) {
            return {
                success: false,
                inserted,
                errors: [error instanceof Error ? error.message : "Unknown error"],
            };
        }
    }

    // Check if item exists
    async exists(key: IDBValidKey): Promise<boolean> {
        try {
            const result = await this.get(key);
            return result.success && result.data !== undefined;
        } catch {
            return false;
        }
    }

    // Count items in store
    async count(): Promise<OperationResult<number>> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const count = await tx.store.count();
            return { success: true, data: count };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
}
