import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORES, INDEX } from './conf';


export async function getAllStores(dbName: string): Promise<string[]> {
    const db = await openDB(dbName);
    return Array.from(db.objectStoreNames);
}

export async function checkIsKnownDMChat(chatEmail: string): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const dmChatsStore = db.transaction(STORES.DM_CHATS).objectStore(STORES.DM_CHATS);
    const dmChat = await dmChatsStore.index(INDEX.DM_CHATS).get(chatEmail);
    return dmChat !== undefined;
}

export async function checkIsKnownGMChat(chatEmail: string): Promise<boolean> {
    const db = await openDB(DB_NAME, DB_VERSION);
    const gmChatsStore = db.transaction(STORES.GM_CHATS).objectStore(STORES.GM_CHATS);
    const gmChat = await gmChatsStore.index(INDEX.GM_CHATS).get(chatEmail);
    return gmChat !== undefined;
}

// const _existenceChecker = {
//     dmChats: async (chatEmail: string) => {
//         const dmChat = _getDataWithIndex.dmChats(chatEmail)
//         return dmChat !== undefined;
//     },
//     dmSpecificMessage: async (chatEmail: string, messageIdWithChatEmail: string) => {
//         const dmMessage = _getDataWithIndex.dmSpecificMessage(chatEmail, messageIdWithChatEmail)
//         return dmMessage !== undefined;
//     },
//     dmThreadMessages: async (chatEmail: string, messageIdWithChatEmailAndThreadId: string) => {
//         const dmThread = _getDataWithIndex.dmThreadMessages(chatEmail, messageIdWithChatEmailAndThreadId)
//         return dmThread !== undefined;
//     },
//     gmChats: async (chatEmail: string) => {
//         const gmChat = _getDataWithIndex.gmChats(chatEmail)
//         return gmChat !== undefined;
//     },
//     gmSpecificMessage: async (chatEmail: string, messageIdWithChatEmail: string) => {
//         const gmMessage = _getDataWithIndex.gmSpecificMessage(chatEmail, messageIdWithChatEmail)
//         return gmMessage !== undefined;
//     },
//     gmThreadMessages: async (chatEmail: string, messageIdWithChatEmailAndThreadId: string) => {
//         const gmThread = _getDataWithIndex.gmThreadMessages(chatEmail, messageIdWithChatEmailAndThreadId)
//         return gmThread !== undefined;
//     }
// }

// async function _ExistenceChecker(checkerProps: any) {
//     if (checkerProps.storeName === STORES.DM_CHATS) {
//         const if_exist = await _existenceChecker.dmChats(
//             checkerProps.chatEmail)
//         return if_exist
//     } else if (checkerProps.storeName === STORES.DM_MESSAGES) {
//         const if_exist = await _existenceChecker.dmSpecificMessage(
//             checkerProps.chatEmail,
//             checkerProps.messageIdWithChatEmail)
//         return if_exist
//     } else if (checkerProps.storeName === STORES.DM_THREAD_MESSAGES) {
//         const if_exist = await _existenceChecker.dmThreadMessages(
//             checkerProps.chatEmail,
//             checkerProps.messageIdWithChatEmailAndThreadId)
//         return if_exist
//     } else if (checkerProps.storeName === STORES.GM_CHATS) {
//         const if_exist = await _existenceChecker.gmChats(
//             checkerProps.chatEmail)
//         return if_exist
//     } else if (checkerProps.storeName === STORES.GM_MESSAGES) {
//         const if_exist = await _existenceChecker.gmSpecificMessage(
//             checkerProps.chatEmail,
//             checkerProps.messageIdWithChatEmail)
//         return if_exist
//     } else if (checkerProps.storeName === STORES.GM_THREAD_MESSAGES) {
//         const if_exist = await _existenceChecker.gmThreadMessages(
//             checkerProps.chatEmail,
//             checkerProps.messageIdWithChatEmailAndThreadId)
//         return if_exist
//     } else {
//         console.error("Unexpected storeName:", checkerProps.storeName)
//         return true
//     }
// }