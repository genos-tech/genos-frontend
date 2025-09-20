import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORES } from "./conf";

export async function getAllStores(dbName: string): Promise<string[]> {
    const db = await openDB(dbName);
    return Array.from(db.objectStoreNames);
}

export async function checkNoteExists(noteId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const note = await db.get(STORES.NOTES, noteId);
    return note !== undefined;
}

export async function checkIsKnownDMChat(chatId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const dmChat = await db.get(STORES.DM_CHATS, chatId);
    return dmChat !== undefined;
}

export async function checkIsKnownGMChat(chatId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const gmChat = await db.get(STORES.GM_CHATS, chatId);
    return gmChat !== undefined;
}

export async function checkIsKnownPMChat(chatId: number): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const pmChat = await db.get(STORES.PM_CHATS, chatId);
    return pmChat !== undefined;
}
