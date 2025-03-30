import { openDB } from "idb";
import { initDB } from './schema';
import { DB_NAME, DB_VERSION, STORES, INDEX } from './conf';


const _messageIdWithChatId = {
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
        const dmThreadMessagesStore = db.transaction(STORES.DM_THREAD_MESSAGES).objectStore(
            STORES.DM_THREAD_MESSAGES
        );
        const dmThreadMessages = await dmThreadMessagesStore.index(INDEX.DM_THREAD_MESSAGES_COMPOUND).getAll(
            [chatId, threadId]);

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
        const gmThreadMessagesStore = db.transaction(STORES.GM_THREAD_MESSAGES).objectStore(
            STORES.GM_THREAD_MESSAGES
        );
        const gmThreadMessage = await gmThreadMessagesStore.index(INDEX.GM_THREAD_MESSAGES_COMPOUND).getAll(
            [chatId, threadId]);

        return gmThreadMessage;
    }
}


const _getDataWithIndex = {
    dmChats: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.DM_CHATS, chatId);
    },
    gmChats: async (chatId: number) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        return db.get(STORES.GM_CHATS, chatId);
    }
}

export const batchInsertMessages = async (props: any) => {

    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(props.storeName, "readwrite");
    const store = tx.objectStore(props.storeName);

    props.messages.forEach((message: any) => {
        store.put(message);
    });

    await tx.done;
}

export const miniBatchInsertMessages = async (props: any) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(props.storeName, "readwrite");
    const store = tx.objectStore(props.storeName);

    props.miniBatchMessages.forEach((message: any) => {
        store.put(message);
    });

    await tx.done;
}


export const addData = async (props: any) => {
    const db = await initDB();
    const tx = db.transaction(props.storeName, "readwrite");
    await tx.store.put(props.data);
    await tx.done;
};

export const getData = async (storeName: string, id: string) => {
    const db = await initDB();
    return db.get(storeName, id);
};

export const getSpecificDataWithIndex = async (props: any) => {
    if (props.storeName === STORES.DM_CHATS) {
        const data = await _getDataWithIndex.dmChats(
            props.chatId)
        return data
    }
    if (props.storeName === STORES.GM_CHATS) {
        const data = await _getDataWithIndex.gmChats(
            props.chatId)
        return data
    }
}

export const messageIdWithChatId = async (props: any) => {
    if (props.storeName === STORES.DM_CHATS) {
        const data = await _messageIdWithChatId.dmChats()
        return data
    } else if (props.storeName === STORES.DM_MESSAGES) {
        const data = await _messageIdWithChatId.dmMessages(
            props.chatId)
        return data
    } else if (props.storeName === STORES.DM_THREAD_MESSAGES) {
        const data = await _messageIdWithChatId.dmThreadMessages(
            props.chatId, props.threadId)
        return data
    } else if (props.storeName === STORES.GM_CHATS) {
        const data = await _messageIdWithChatId.gmChats()
        return data
    } else if (props.storeName === STORES.GM_MESSAGES) {
        const data = await _messageIdWithChatId.gmMessages(
            props.chatId)
        return data
    } else if (props.storeName === STORES.GM_THREAD_MESSAGES) {
        const data = await _messageIdWithChatId.gmThreadMessages(
            props.chatId, props.threadId)
        return data
    } else {
        console.error("Unexpected storeName:", props.storeName)
        return []
    }
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
}
