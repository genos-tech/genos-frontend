import { IDBPDatabase, openDB } from "idb";

import { IndexConfig, StoreConfig } from "../types";
import { DB_NAME, DB_VERSION, INDEX_KEY_PATHS, INDEX_NAMES, KEY_PATHS, STORES } from "./constants";

// Store configurations
export const STORE_CONFIGS: Record<string, StoreConfig> = {
    [STORES.USER_INFO]: {
        name: STORES.USER_INFO,
        keyPath: KEY_PATHS.USER_INFO,
        indexes: [
            { name: INDEX_NAMES.USER_INFO, keyPath: INDEX_KEY_PATHS.USER_INFO, unique: false },
        ],
    },
    [STORES.INBOX]: {
        name: STORES.INBOX,
        keyPath: KEY_PATHS.INBOX,
    },
    [STORES.ACTIVITY_MESSAGES]: {
        name: STORES.ACTIVITY_MESSAGES,
        keyPath: KEY_PATHS.ACTIVITY_MESSAGES,
    },
    [STORES.DM_CHATS]: {
        name: STORES.DM_CHATS,
        keyPath: KEY_PATHS.DM_CHATS,
        indexes: [
            { name: INDEX_NAMES.DM_CHATS, keyPath: INDEX_KEY_PATHS.DM_CHATS, unique: false },
        ],
    },
    [STORES.DM_MESSAGES]: {
        name: STORES.DM_MESSAGES,
        keyPath: KEY_PATHS.DM_MESSAGES,
        indexes: [
            { name: INDEX_NAMES.DM_MESSAGES, keyPath: INDEX_KEY_PATHS.DM_MESSAGES, unique: false },
            {
                name: INDEX_NAMES.DM_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.DM_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.DM_MESSAGES_COMPOUND[1],
                ],
                unique: true,
            },
        ],
    },
    [STORES.DM_THREAD_MESSAGES]: {
        name: STORES.DM_THREAD_MESSAGES,
        keyPath: KEY_PATHS.DM_THREAD_MESSAGES,
        indexes: [
            {
                name: INDEX_NAMES.DM_THREAD_MESSAGES,
                keyPath: INDEX_KEY_PATHS.DM_THREAD_MESSAGES,
                unique: false,
            },
            {
                name: INDEX_NAMES.DM_THREAD_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.DM_THREAD_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.DM_THREAD_MESSAGES_COMPOUND[1],
                ],
                unique: false,
            },
        ],
    },
    [STORES.GM_CHATS]: {
        name: STORES.GM_CHATS,
        keyPath: KEY_PATHS.GM_CHATS,
        indexes: [
            { name: INDEX_NAMES.GM_CHATS, keyPath: INDEX_KEY_PATHS.GM_CHATS, unique: false },
        ],
    },
    [STORES.GM_MESSAGES]: {
        name: STORES.GM_MESSAGES,
        keyPath: KEY_PATHS.GM_MESSAGES,
        indexes: [
            { name: INDEX_NAMES.GM_MESSAGES, keyPath: INDEX_KEY_PATHS.GM_MESSAGES, unique: false },
            {
                name: INDEX_NAMES.GM_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.GM_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.GM_MESSAGES_COMPOUND[1],
                ],
                unique: true,
            },
        ],
    },
    [STORES.GM_THREAD_MESSAGES]: {
        name: STORES.GM_THREAD_MESSAGES,
        keyPath: KEY_PATHS.GM_THREAD_MESSAGES,
        indexes: [
            {
                name: INDEX_NAMES.GM_THREAD_MESSAGES,
                keyPath: INDEX_KEY_PATHS.GM_THREAD_MESSAGES,
                unique: false,
            },
            {
                name: INDEX_NAMES.GM_THREAD_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.GM_THREAD_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.GM_THREAD_MESSAGES_COMPOUND[1],
                ],
                unique: false,
            },
        ],
    },
    [STORES.PM_CHATS]: {
        name: STORES.PM_CHATS,
        keyPath: KEY_PATHS.PM_CHATS,
        indexes: [
            { name: INDEX_NAMES.PM_CHATS, keyPath: INDEX_KEY_PATHS.PM_CHATS, unique: false },
        ],
    },
    [STORES.PM_MESSAGES]: {
        name: STORES.PM_MESSAGES,
        keyPath: KEY_PATHS.PM_MESSAGES,
        indexes: [
            { name: INDEX_NAMES.PM_MESSAGES, keyPath: INDEX_KEY_PATHS.PM_MESSAGES, unique: false },
            {
                name: INDEX_NAMES.PM_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.PM_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.PM_MESSAGES_COMPOUND[1],
                ],
                unique: true,
            },
        ],
    },
    [STORES.PM_THREAD_MESSAGES]: {
        name: STORES.PM_THREAD_MESSAGES,
        keyPath: KEY_PATHS.PM_THREAD_MESSAGES,
        indexes: [
            {
                name: INDEX_NAMES.PM_THREAD_MESSAGES,
                keyPath: INDEX_KEY_PATHS.PM_THREAD_MESSAGES,
                unique: false,
            },
            {
                name: INDEX_NAMES.PM_THREAD_MESSAGES_COMPOUND,
                keyPath: [
                    INDEX_KEY_PATHS.PM_THREAD_MESSAGES_COMPOUND[0],
                    INDEX_KEY_PATHS.PM_THREAD_MESSAGES_COMPOUND[1],
                ],
                unique: false,
            },
        ],
    },
    [STORES.FLAGGED_MESSAGES]: {
        name: STORES.FLAGGED_MESSAGES,
        keyPath: KEY_PATHS.FLAGGED_MESSAGES,
    },
    [STORES.TASKS]: {
        name: STORES.TASKS,
        keyPath: KEY_PATHS.TASKS,
        indexes: [
            { name: INDEX_NAMES.TASKS, keyPath: INDEX_KEY_PATHS.TASKS, unique: false },
            {
                name: INDEX_NAMES.TASKS_COMPOUND,
                keyPath: [INDEX_KEY_PATHS.TASKS_COMPOUND[0], INDEX_KEY_PATHS.TASKS_COMPOUND[1]],
                unique: false,
            },
        ],
    },
    [STORES.PERSONAL_NOTES]: {
        name: STORES.PERSONAL_NOTES,
        keyPath: KEY_PATHS.PERSONAL_NOTES,
    },
    [STORES.TASK_NOTES]: {
        name: STORES.TASK_NOTES,
        keyPath: KEY_PATHS.TASK_NOTES,
    },
    [STORES.CHAT_NOTES]: {
        name: STORES.CHAT_NOTES,
        keyPath: KEY_PATHS.CHAT_NOTES,
    },
};

// Initialize database with proper schema
export const initDB = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Create all stores with their configurations
            Object.values(STORE_CONFIGS).forEach((config) => {
                if (!db.objectStoreNames.contains(config.name)) {
                    const store = db.createObjectStore(config.name, {
                        keyPath: config.keyPath,
                    });

                    // Create indexes if they exist
                    config.indexes?.forEach((index) => {
                        store.createIndex(index.name, index.keyPath, {
                            unique: index.unique || false,
                        });
                    });
                }
            });
        },
    });
};

// Helper function to create a store with indexes
const createStoreWithIndexes = (
    db: IDBDatabase,
    storeName: string,
    keyPath: string,
    indexes: IndexConfig[] = []
) => {
    if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath });
        indexes.forEach((index) => {
            store.createIndex(index.name, index.keyPath, {
                unique: index.unique || false,
            });
        });
    }
};
