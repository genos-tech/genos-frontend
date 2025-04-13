// src/utils/indexedDB.ts
import { openDB, IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORES, KEY_PATH, INDEX, INDEX_KEY } from './conf';

export const initDB = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // User info
            if (!db.objectStoreNames.contains(STORES.USER_INFO)) {
                db.createObjectStore(
                    STORES.USER_INFO,
                    { keyPath: KEY_PATH.USER_INFO }
                );
            }

            // For DM chats
            // DM chats store, not including messages
            if (!db.objectStoreNames.contains(STORES.DM_CHATS)) {
                const dmChatsStore = db.createObjectStore(
                    STORES.DM_CHATS,
                    { keyPath: KEY_PATH.DM_CHATS }
                );
                dmChatsStore.createIndex(
                    INDEX.DM_CHATS,
                    INDEX_KEY.DM_CHATS,
                    { unique: false }
                );
            }
            if (!db.objectStoreNames.contains(STORES.DM_MESSAGES)) {
                const dmMessagesStore = db.createObjectStore(
                    STORES.DM_MESSAGES,
                    { keyPath: KEY_PATH.DM_MESSAGES }
                );
                // Index
                dmMessagesStore.createIndex(
                    INDEX.DM_MESSAGES,
                    INDEX_KEY.DM_MESSAGES,
                    { unique: false }
                );
                dmMessagesStore.createIndex(
                    INDEX.DM_MESSAGES_COMPOUND,
                    INDEX_KEY.DM_MESSAGES_COMPOUND,
                    { unique: true }
                );
            }
            if (!db.objectStoreNames.contains(STORES.DM_THREAD_MESSAGES)) {
                const dmThreadMessagesStore = db.createObjectStore(
                    STORES.DM_THREAD_MESSAGES,
                    { keyPath: KEY_PATH.DM_THREAD_MESSAGES }
                );
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
                const gmChatsStore = db.createObjectStore(
                    STORES.GM_CHATS,
                    { keyPath: KEY_PATH.GM_CHATS }
                );
                gmChatsStore.createIndex(
                    INDEX.GM_CHATS,
                    INDEX_KEY.GM_CHATS,
                    { unique: false }
                );
            }
            if (!db.objectStoreNames.contains(STORES.GM_MESSAGES)) {
                const gmMessagesStore = db.createObjectStore(
                    STORES.GM_MESSAGES,
                    { keyPath: KEY_PATH.GM_MESSAGES }
                );
                // Index
                gmMessagesStore.createIndex(
                    INDEX.GM_MESSAGES,
                    INDEX_KEY.GM_MESSAGES,
                    { unique: false }
                );
                gmMessagesStore.createIndex(
                    INDEX.GM_MESSAGES_COMPOUND,
                    INDEX_KEY.GM_MESSAGES_COMPOUND,
                    { unique: true }
                );
            }
            if (!db.objectStoreNames.contains(STORES.GM_THREAD_MESSAGES)) {
                const gmThreadMessagesStore = db.createObjectStore(
                    STORES.GM_THREAD_MESSAGES,
                    { keyPath: KEY_PATH.GM_THREAD_MESSAGES }
                );
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

            // For Tasks
            if (!db.objectStoreNames.contains(STORES.TASKS)) {
                const tasksStore = db.createObjectStore(
                    STORES.TASKS,
                    { keyPath: KEY_PATH.TASKS }
                );
                tasksStore.createIndex(
                    INDEX.TASKS,
                    INDEX_KEY.TASKS,
                    { unique: false }
                );
            }
        },
    });
};
