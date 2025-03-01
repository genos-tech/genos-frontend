import { openDB } from "idb";
import { initDB } from './schema';
import { DB_NAME, DB_VERSION, STORES, INDEX } from './conf';


const _getAllDataWithIndex = {
    dmChats: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmChatsStore = db.transaction(STORES.DM_CHATS).objectStore(STORES.DM_CHATS);
        const dmChats = await dmChatsStore.getAll();

        return dmChats;
    },
    dmMessages: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmMessagesStore = db.transaction(STORES.DM_MESSAGES).objectStore(STORES.DM_MESSAGES);
        const dmMessages = await dmMessagesStore.index(INDEX.DM_MESSAGES).getAll(chatEmail);

        return dmMessages;
    },
    dmThreadMessages: async (chatEmail: string, threadId: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmThreadMessagesStore = db.transaction(STORES.DM_THREAD_MESSAGES).objectStore(
            STORES.DM_THREAD_MESSAGES
        );
        const dmThreadMessages = await dmThreadMessagesStore.index(INDEX.DM_THREAD_MESSAGES_COMPOUND).getAll(
            [chatEmail, threadId]);

        return dmThreadMessages;
    },
    gmChats: async () => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmChatsStore = db.transaction(STORES.GM_CHATS).objectStore(STORES.GM_CHATS);
        const gmChat = await gmChatsStore.getAll();

        return gmChat;
    },
    gmMessages: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmMessagesStore = db.transaction(STORES.GM_MESSAGES).objectStore(STORES.GM_MESSAGES);
        const gmMessages = await gmMessagesStore.index(INDEX.GM_MESSAGES).getAll(chatEmail);

        return gmMessages;
    },
    gmThreadMessages: async (chatEmail: string, threadId: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmThreadMessagesStore = db.transaction(STORES.GM_THREAD_MESSAGES).objectStore(
            STORES.GM_THREAD_MESSAGES
        );
        const gmThreadMessage = await gmThreadMessagesStore.index(INDEX.GM_THREAD_MESSAGES_COMPOUND).getAll(
            [chatEmail, threadId]);

        return gmThreadMessage;
    }
}


const _getDataWithIndex = {
    dmChats: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmChatsStore = db.transaction(STORES.DM_CHATS).objectStore(STORES.DM_CHATS);
        const dmChat = await dmChatsStore.index(INDEX.DM_CHATS).get(chatEmail);

        return dmChat;
    },
    dmMessages: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmMessagesStore = db.transaction(STORES.DM_MESSAGES).objectStore(STORES.DM_MESSAGES);
        const dmMessages = await dmMessagesStore.index(INDEX.DM_MESSAGES).get(chatEmail);

        console.log("dmMessages:", dmMessages)

        return dmMessages;
    },
    dmSpecificMessage: async (chatEmail: string, messageIdWithChatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmMessagesStore = db.transaction(STORES.DM_MESSAGES).objectStore(STORES.DM_MESSAGES);
        const dmMessage = await dmMessagesStore.index(INDEX.DM_MESSAGES).get(
            [chatEmail, messageIdWithChatEmail]);

        return dmMessage;
    },
    dmThreadMessages: async (chatEmail: string, threadId: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const dmThreadMessagesStore = db.transaction(STORES.DM_THREAD_MESSAGES).objectStore(
            STORES.DM_THREAD_MESSAGES
        );
        const dmThreadMessages = await dmThreadMessagesStore.index(INDEX.DM_THREAD_MESSAGES_COMPOUND).get(
            [chatEmail, threadId]);

        return dmThreadMessages;
    },
    gmChats: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmChatsStore = db.transaction(STORES.GM_CHATS).objectStore(STORES.GM_CHATS);
        const gmChat = await gmChatsStore.index(INDEX.GM_CHATS).get(chatEmail);

        return gmChat;
    },
    gmMessages: async (chatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmMessagesStore = db.transaction(STORES.GM_MESSAGES).objectStore(STORES.GM_MESSAGES);
        const gmMessages = await gmMessagesStore.index(INDEX.GM_MESSAGES_COMPOUND).get(
            chatEmail);

        return gmMessages;
    },
    gmSpecificMessage: async (chatEmail: string, messageIdWithChatEmail: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmMessagesStore = db.transaction(STORES.GM_MESSAGES).objectStore(STORES.GM_MESSAGES);
        const gmMessage = await gmMessagesStore.index(INDEX.GM_MESSAGES_COMPOUND).get(
            [chatEmail, messageIdWithChatEmail]);

        return gmMessage;
    },
    gmThreadMessages: async (chatEmail: string, threadId: string) => {
        const db = await openDB(DB_NAME, DB_VERSION);
        const gmThreadMessagesStore = db.transaction(STORES.GM_THREAD_MESSAGES).objectStore(
            STORES.GM_THREAD_MESSAGES
        );
        const gmThreadMessage = await gmThreadMessagesStore.index(INDEX.GM_THREAD_MESSAGES_COMPOUND).get(
            [chatEmail, threadId]);

        return gmThreadMessage;
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
            props.chatEmail)
        return data
    }
    if (props.storeName === STORES.GM_CHATS) {
        const data = await _getDataWithIndex.gmChats(
            props.chatEmail)
        return data
    }
}

export const getAllDataWithIndex = async (props: any) => {
    if (props.storeName === STORES.DM_CHATS) {
        const data = await _getAllDataWithIndex.dmChats()
        return data
    } else if (props.storeName === STORES.DM_MESSAGES) {
        const data = await _getAllDataWithIndex.dmMessages(
            props.chatEmail)
        return data
    } else if (props.storeName === STORES.DM_THREAD_MESSAGES) {
        const data = await _getAllDataWithIndex.dmThreadMessages(
            props.chatEmail, props.threadId)
        return data
    } else if (props.storeName === STORES.GM_CHATS) {
        const data = await _getAllDataWithIndex.gmChats()
        return data
    } else if (props.storeName === STORES.GM_MESSAGES) {
        const data = await _getAllDataWithIndex.gmMessages(
            props.chatEmail)
        return data
    } else if (props.storeName === STORES.GM_THREAD_MESSAGES) {
        const data = await _getAllDataWithIndex.gmThreadMessages(
            props.chatEmail, props.threadId)
        return data
    } else {
        console.error("Unexpected storeName:", props.storeName)
        return []
    }
};

export const getAllData = async (storeName: string) => {
    // console.log("getAllData:", storeName)
    const db = await initDB();
    return db.getAll(storeName);
};

export const deleteData = async (storeName: string, id: string) => {
    // console.log("deleteData:", storeName)
    const db = await initDB();
    const tx = db.transaction(storeName, "readwrite");
    await tx.store.delete(id);
    await tx.done;
};

export const deleteIndexedDB = async () => {
    indexedDB.deleteDatabase(DB_NAME);
    console.log(`IndexedDB "${DB_NAME}" deleted. Recreating...`);
};
