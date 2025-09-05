import { openDB } from "idb";
import { initDB } from "./schema";
import { DB_NAME, DB_VERSION, STORES, INDEX } from "./conf";

const _messageIdWithChatId = {
    Inbox: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const inboxStore = db.transaction(STORES.INBOX).objectStore(STORES.INBOX);
        const inbox = await inboxStore.getAll();
        return inbox;
    },
    activityMessages: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const activityMessagesStore = db
            .transaction(STORES.ACTIVITY_MESSAGES)
            .objectStore(STORES.ACTIVITY_MESSAGES);
        const activityMessages = await activityMessagesStore.getAll();

        return activityMessages;
    },
    dmChats: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmChatsStore = db.transaction(STORES.DM_CHATS).objectStore(STORES.DM_CHATS);
        const dmChats = await dmChatsStore.getAll();

        return dmChats;
    },
    dmMessages: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmMessagesStore = db.transaction(STORES.DM_MESSAGES).objectStore(STORES.DM_MESSAGES);
        const dmMessages = await dmMessagesStore.index(INDEX.DM_MESSAGES).getAll(chatId);

        return dmMessages;
    },
    dmThreadMessages: async (chatId: string, threadId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmThreadMessagesStore = db
            .transaction(STORES.DM_THREAD_MESSAGES)
            .objectStore(STORES.DM_THREAD_MESSAGES);
        const dmThreadMessages = await dmThreadMessagesStore
            .index(INDEX.DM_THREAD_MESSAGES_COMPOUND)
            .getAll([chatId, threadId]);

        return dmThreadMessages;
    },
    gmChats: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmChatsStore = db.transaction(STORES.GM_CHATS).objectStore(STORES.GM_CHATS);
        const gmChat = await gmChatsStore.getAll();

        return gmChat;
    },
    gmMessages: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmMessagesStore = db.transaction(STORES.GM_MESSAGES).objectStore(STORES.GM_MESSAGES);
        const gmMessages = await gmMessagesStore.index(INDEX.GM_MESSAGES).getAll(chatId);

        return gmMessages;
    },
    gmThreadMessages: async (chatId: number, threadId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmThreadMessagesStore = db
            .transaction(STORES.GM_THREAD_MESSAGES)
            .objectStore(STORES.GM_THREAD_MESSAGES);
        const gmThreadMessage = await gmThreadMessagesStore
            .index(INDEX.GM_THREAD_MESSAGES_COMPOUND)
            .getAll([chatId, threadId]);

        return gmThreadMessage;
    },
    pmChats: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const pmChatsStore = db.transaction(STORES.PM_CHATS).objectStore(STORES.PM_CHATS);
        const pmChat = await pmChatsStore.getAll();

        return pmChat;
    },
    pmMessages: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const pmMessagesStore = db.transaction(STORES.PM_MESSAGES).objectStore(STORES.PM_MESSAGES);
        const pmMessages = await pmMessagesStore.index(INDEX.PM_MESSAGES).getAll(chatId);

        return pmMessages;
    },
    pmThreadMessages: async (chatId: number, threadId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const pmThreadMessagesStore = db
            .transaction(STORES.PM_THREAD_MESSAGES)
            .objectStore(STORES.PM_THREAD_MESSAGES);
        const pmThreadMessage = await pmThreadMessagesStore
            .index(INDEX.PM_THREAD_MESSAGES_COMPOUND)
            .getAll([chatId, threadId]);

        return pmThreadMessage;
    },
};

const _getDataWithIndex = {
    teamMembers: async (teamId: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.USER_INFO, teamId);
    },
    dmChats: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.DM_CHATS, chatId);
    },
    gmChats: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.GM_CHATS, chatId);
    },
    pmChats: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.PM_CHATS, chatId);
    },
};

export const batchInsertMessages = async (props: any) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(props.storeName, "readwrite");
    const store = tx.objectStore(props.storeName);

    props.messages.forEach((message: any) => {
        store.put(message);
    });

    await tx.done;
};

export const miniBatchInsertMessages = async (props: any) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(props.storeName, "readwrite");
    const store = tx.objectStore(props.storeName);

    props.miniBatchMessages.forEach((message: any) => {
        store.put(message);
    });

    await tx.done;
};

export const addData = async (props: any) => {
    const db = await initDB();
    const tx = db.transaction(props.storeName, "readwrite");
    await tx.store.put(props.data);
    await tx.done;
};

export const getData = async (props: any) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.get(props.storeName, props.key);
};

export const getSpecificDataWithIndex = async (props: any) => {
    if (props.storeName === STORES.DM_CHATS) {
        const data = await _getDataWithIndex.dmChats(props.chatId);
        return data;
    }
    if (props.storeName === STORES.GM_CHATS) {
        const data = await _getDataWithIndex.gmChats(props.chatId);
        return data;
    }
    if (props.storeName === STORES.PM_CHATS) {
        const data = await _getDataWithIndex.gmChats(props.chatId);
        return data;
    }
};

export const messageIdWithChatId = async (props: any) => {
    if (props.storeName === STORES.INBOX) {
        const data = await _messageIdWithChatId.Inbox();
        return data;
    } else if (props.storeName === STORES.ACTIVITY_MESSAGES) {
        const data = await _messageIdWithChatId.activityMessages();
        return data;
    } else if (props.storeName === STORES.DM_CHATS) {
        const data = await _messageIdWithChatId.dmChats();
        return data;
    } else if (props.storeName === STORES.DM_MESSAGES) {
        const data = await _messageIdWithChatId.dmMessages(props.chatId);
        return data;
    } else if (props.storeName === STORES.DM_THREAD_MESSAGES) {
        const data = await _messageIdWithChatId.dmThreadMessages(props.chatId, props.threadId);
        return data;
    } else if (props.storeName === STORES.GM_CHATS) {
        const data = await _messageIdWithChatId.gmChats();
        return data;
    } else if (props.storeName === STORES.GM_MESSAGES) {
        const data = await _messageIdWithChatId.gmMessages(props.chatId);
        return data;
    } else if (props.storeName === STORES.GM_THREAD_MESSAGES) {
        const data = await _messageIdWithChatId.gmThreadMessages(props.chatId, props.threadId);
        return data;
    } else if (props.storeName === STORES.PM_CHATS) {
        const data = await _messageIdWithChatId.pmChats();
        return data;
    } else if (props.storeName === STORES.PM_MESSAGES) {
        const data = await _messageIdWithChatId.pmMessages(props.chatId);
        return data;
    } else if (props.storeName === STORES.PM_THREAD_MESSAGES) {
        const data = await _messageIdWithChatId.pmThreadMessages(props.chatId, props.threadId);
        return data;
    } else {
        console.error("Unexpected storeName:", props.storeName);
        return [];
    }
};

export const getTeamMembers = async (teamId: string) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const userInfoStore = db.transaction(STORES.USER_INFO).objectStore(STORES.USER_INFO);
    const teamMembers = await userInfoStore.index(INDEX.USER_INFO).getAll(teamId);

    return teamMembers;
};

export const getProjectTasks = async (projectId: number) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const taskStore = db.transaction(STORES.TASKS).objectStore(STORES.TASKS);
    const tasks = await taskStore.index(INDEX.TASKS).getAll(projectId);

    return tasks;
};

const getTasksByStatus = async (projectId: number, status: string) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const taskStore = db.transaction(STORES.TASKS, "readonly").objectStore(STORES.TASKS);
    const tasks = await taskStore.index(INDEX.TASKS_COMPOUND).getAll([projectId, status]);

    return tasks;
};

export const getTasksByMultipleStatus = async (projectId: number, statuses: string[]) => {
    const results = await Promise.all(
        statuses.map((status) => getTasksByStatus(projectId, status))
    );
    return results.flat();
};

export const getAllData = async (storeName: string) => {
    const db = await initDB();
    return db.getAll(storeName);
};

export const deleteData = async (storeName: string, id: string) => {
    const db = await initDB();
    const tx = db.transaction(storeName, "readwrite");
    await tx.store.delete(id);
    await tx.done;
};

export const deleteIndexedDB = async () => {
    indexedDB.deleteDatabase(DB_NAME);
    console.log(`IndexedDB "${DB_NAME}" deleted. Recreating...`);
};

export const clearStore = async (storeName: string) => {
    const db = await initDB();
    const tx = db.transaction(storeName, "readwrite");
    const objectStore = tx.objectStore(storeName);
    await objectStore.clear();
    await tx.done;
};

export const getLatestDMChat = async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.DM_CHATS, "readonly");
    const store = tx.objectStore(STORES.DM_CHATS);
    const index = store.index(INDEX.DM_CHATS);

    // Use `openCursor()` and await the first result
    const cursor = await index.openCursor(null, "prev"); // Get latest first

    return cursor ? cursor.value : null; // Return the latest record
};

export const getLatestGMChat = async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.GM_CHATS, "readonly");
    const store = tx.objectStore(STORES.GM_CHATS);
    const index = store.index(INDEX.GM_CHATS);

    // Use `openCursor()` and await the first result
    const cursor = await index.openCursor(null, "prev"); // Get latest first

    return cursor ? cursor.value : null; // Return the latest record
};

export const getLatestPMChat = async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.PM_CHATS, "readonly");
    const store = tx.objectStore(STORES.PM_CHATS);
    const index = store.index(INDEX.PM_CHATS);

    // Use `openCursor()` and await the first result
    const cursor = await index.openCursor(null, "prev"); // Get latest first

    return cursor ? cursor.value : null; // Return the latest record
};
