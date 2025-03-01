export const DB_NAME = "myDatabase";
export const DB_VERSION = 1;

export const STORES = {
    USER_INFO: "users",
    DM_CHATS: "dmChats",
    DM_MESSAGES: "dmMessages",
    DM_THREAD_MESSAGES: "dmThreadMessages",
    GM_CHATS: "gmChats",
    GM_MESSAGES: "gmMessages",
    GM_THREAD_MESSAGES: "gmThreadMessages"
};

export const KEY_PATH = {
    USER_INFO: "userName",
    DM_CHATS: "chatEmail",
    DM_MESSAGES: "messageIdWithChatEmail",
    DM_THREAD_MESSAGES: "messageIdWithChatEmailAndThreadId",
    GM_CHATS: "chatEmail",
    GM_MESSAGES: "messageIdWithChatEmail",
    GM_THREAD_MESSAGES: "messageIdWithChatEmailAndThreadId"
}

export const INDEX = {
    USER_INFO: "userNameIndex",
    DM_CHATS: "chatEmailIndex",
    DM_MESSAGES: "chatEmailIndex",
    DM_MESSAGES_COMPOUND: "compoundDMMessageIdIndex",
    DM_THREAD_MESSAGES: "chatEmailIndex",
    DM_THREAD_MESSAGES_COMPOUND: "compoundDMThreadIdIndex",
    GM_CHATS: "chatEmailIndex",
    GM_MESSAGES: "chatEmailIndex",
    GM_MESSAGES_COMPOUND: "compoundGMMessageIdIndex",
    GM_THREAD_MESSAGES: "chatEmailIndex",
    GM_THREAD_MESSAGES_COMPOUND: "compoundGMThreadIdIndex"
}

export const INDEX_KEY = {
    USER_INFO: "userName",
    DM_CHATS: "chatEmail",
    DM_MESSAGES: "chatEmail",
    DM_MESSAGES_COMPOUND: ["chatEmail", "messageIdWithChatEmail"],
    DM_THREAD_MESSAGES: "chatEmail",
    DM_THREAD_MESSAGES_COMPOUND: ["chatEmail", "threadId"],
    GM_CHATS: "chatEmail",
    GM_MESSAGES: "chatEmail",
    GM_MESSAGES_COMPOUND: ["chatEmail", "messageIdWithChatEmail"],
    GM_THREAD_MESSAGES: "chatEmail",
    GM_THREAD_MESSAGES_COMPOUND: ["chatEmail", "threadId"]
}