// src/utils/indexedDB.ts
import { openDB, IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORES, KEY_PATH, INDEX, INDEX_KEY } from "./conf";

export const initDB = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // User info
            if (!db.objectStoreNames.contains(STORES.USER_INFO)) {
                const userInfoStore = db.createObjectStore(STORES.USER_INFO, {
                    keyPath: KEY_PATH.USER_INFO,
                });
                userInfoStore.createIndex(INDEX.USER_INFO, INDEX_KEY.USER_INFO, { unique: false });
            }

            // Inbox
            if (!db.objectStoreNames.contains(STORES.INBOX)) {
                db.createObjectStore(STORES.INBOX, {
                    keyPath: KEY_PATH.INBOX,
                });
            }

            // For Activity messages
            if (!db.objectStoreNames.contains(STORES.ACTIVITY_MESSAGES)) {
                db.createObjectStore(STORES.ACTIVITY_MESSAGES, {
                    keyPath: KEY_PATH.ACTIVITY_MESSAGES,
                });
            }

            // For DM chats
            // DM chats store, not including messages
            if (!db.objectStoreNames.contains(STORES.DM_CHATS)) {
                const dmChatsStore = db.createObjectStore(STORES.DM_CHATS, {
                    keyPath: KEY_PATH.DM_CHATS,
                });
                dmChatsStore.createIndex(INDEX.DM_CHATS, INDEX_KEY.DM_CHATS, { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.DM_MESSAGES)) {
                const dmMessagesStore = db.createObjectStore(STORES.DM_MESSAGES, {
                    keyPath: KEY_PATH.DM_MESSAGES,
                });
                // Index
                dmMessagesStore.createIndex(INDEX.DM_MESSAGES, INDEX_KEY.DM_MESSAGES, {
                    unique: false,
                });
                dmMessagesStore.createIndex(
                    INDEX.DM_MESSAGES_COMPOUND,
                    INDEX_KEY.DM_MESSAGES_COMPOUND,
                    { unique: true }
                );
            }
            if (!db.objectStoreNames.contains(STORES.DM_THREAD_MESSAGES)) {
                const dmThreadMessagesStore = db.createObjectStore(STORES.DM_THREAD_MESSAGES, {
                    keyPath: KEY_PATH.DM_THREAD_MESSAGES,
                });
                // Index
                dmThreadMessagesStore.createIndex(
                    INDEX.DM_THREAD_MESSAGES,
                    INDEX_KEY.DM_THREAD_MESSAGES,
                    { unique: false }
                );
                dmThreadMessagesStore.createIndex(
                    INDEX.DM_THREAD_MESSAGES_COMPOUND,
                    INDEX_KEY.DM_THREAD_MESSAGES_COMPOUND,
                    { unique: false }
                );
            }

            // For GM messages
            // GM chats store, not including messages
            if (!db.objectStoreNames.contains(STORES.GM_CHATS)) {
                const gmChatsStore = db.createObjectStore(STORES.GM_CHATS, {
                    keyPath: KEY_PATH.GM_CHATS,
                });
                gmChatsStore.createIndex(INDEX.GM_CHATS, INDEX_KEY.GM_CHATS, { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.GM_MESSAGES)) {
                const gmMessagesStore = db.createObjectStore(STORES.GM_MESSAGES, {
                    keyPath: KEY_PATH.GM_MESSAGES,
                });
                // Index
                gmMessagesStore.createIndex(INDEX.GM_MESSAGES, INDEX_KEY.GM_MESSAGES, {
                    unique: false,
                });
                gmMessagesStore.createIndex(
                    INDEX.GM_MESSAGES_COMPOUND,
                    INDEX_KEY.GM_MESSAGES_COMPOUND,
                    { unique: true }
                );
            }
            if (!db.objectStoreNames.contains(STORES.GM_THREAD_MESSAGES)) {
                const gmThreadMessagesStore = db.createObjectStore(STORES.GM_THREAD_MESSAGES, {
                    keyPath: KEY_PATH.GM_THREAD_MESSAGES,
                });
                // Index
                gmThreadMessagesStore.createIndex(
                    INDEX.GM_THREAD_MESSAGES,
                    INDEX_KEY.GM_THREAD_MESSAGES,
                    { unique: false }
                );
                gmThreadMessagesStore.createIndex(
                    INDEX.GM_THREAD_MESSAGES_COMPOUND,
                    INDEX_KEY.GM_THREAD_MESSAGES_COMPOUND,
                    { unique: false }
                );
            }

            // For PM messages
            // PM chats store, not including messages
            if (!db.objectStoreNames.contains(STORES.PM_CHATS)) {
                const pmChatsStore = db.createObjectStore(STORES.PM_CHATS, {
                    keyPath: KEY_PATH.PM_CHATS,
                });
                pmChatsStore.createIndex(INDEX.PM_CHATS, INDEX_KEY.PM_CHATS, { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.PM_MESSAGES)) {
                const pmMessagesStore = db.createObjectStore(STORES.PM_MESSAGES, {
                    keyPath: KEY_PATH.PM_MESSAGES,
                });
                // Index
                pmMessagesStore.createIndex(INDEX.PM_MESSAGES, INDEX_KEY.PM_MESSAGES, {
                    unique: false,
                });
                pmMessagesStore.createIndex(
                    INDEX.PM_MESSAGES_COMPOUND,
                    INDEX_KEY.PM_MESSAGES_COMPOUND,
                    { unique: true }
                );
            }
            if (!db.objectStoreNames.contains(STORES.PM_THREAD_MESSAGES)) {
                const pmThreadMessagesStore = db.createObjectStore(STORES.PM_THREAD_MESSAGES, {
                    keyPath: KEY_PATH.PM_THREAD_MESSAGES,
                });
                // Index
                pmThreadMessagesStore.createIndex(
                    INDEX.PM_THREAD_MESSAGES,
                    INDEX_KEY.PM_THREAD_MESSAGES,
                    { unique: false }
                );
                pmThreadMessagesStore.createIndex(
                    INDEX.PM_THREAD_MESSAGES_COMPOUND,
                    INDEX_KEY.PM_THREAD_MESSAGES_COMPOUND,
                    { unique: false }
                );
            }

            // For Tasks
            if (!db.objectStoreNames.contains(STORES.TASKS)) {
                const tasksStore = db.createObjectStore(STORES.TASKS, { keyPath: KEY_PATH.TASKS });
                tasksStore.createIndex(INDEX.TASKS, INDEX_KEY.TASKS, { unique: false });
                tasksStore.createIndex(INDEX.TASKS_COMPOUND, INDEX_KEY.TASKS_COMPOUND, {
                    unique: false,
                });
            }
        },
    });
};
