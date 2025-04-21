import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORES, INDEX } from './conf';


export async function getAllStores(dbName: string): Promise<string[]> {
    const db = await openDB(dbName);
    return Array.from(db.objectStoreNames);
}

export async function checkIsKnownDMChat(chatId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const dmChat = await db.get(STORES.DM_CHATS, chatId);
    return dmChat !== undefined;
}

export async function checkIsKnownGMChat(chatId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const gmChat = await db.get(STORES.DM_CHATS, chatId);
    return gmChat !== undefined;
}
