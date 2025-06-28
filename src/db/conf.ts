export const DB_NAME = "originData";
export const DB_VERSION = 2;

export const STORES = {
    USER_INFO: "users",
    DM_CHATS: "dmChats",
    DM_MESSAGES: "dmMessages",
    DM_THREAD_MESSAGES: "dmThreadMessages",
    GM_CHATS: "gmChats",
    GM_MESSAGES: "gmMessages",
    GM_THREAD_MESSAGES: "gmThreadMessages",
    TASKS: "tasks",
};

export const KEY_PATH = {
    USER_INFO: "userName",
    DM_CHATS: "chatId",
    DM_MESSAGES: "messageIdWithChatId",
    DM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    GM_CHATS: "chatId",
    GM_MESSAGES: "messageIdWithChatId",
    GM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    TASKS: "id",
};

export const INDEX = {
    DM_CHATS: "DmTSLastMessageIndex",
    DM_MESSAGES: "DmMessagesIndex",
    DM_MESSAGES_COMPOUND: "DmMessagesCompoundIndex",
    DM_THREAD_MESSAGES: "DmThreadMessagesIndex",
    DM_THREAD_MESSAGES_COMPOUND: "DmThreadMessagesCompoundIndex",
    GM_CHATS: "GmTSLastMessageIndex",
    GM_MESSAGES: "GmMessagesIndex",
    GM_MESSAGES_COMPOUND: "GmMessagesCompoundIndex",
    GM_THREAD_MESSAGES: "GmThreadMessagesIndex",
    GM_THREAD_MESSAGES_COMPOUND: "GmThreadMessagesCompoundIndex",
    TASKS: "TasksIndex",
};

export const INDEX_KEY = {
    DM_CHATS: "TSLastMessage",
    DM_MESSAGES: "chatId",
    DM_MESSAGES_COMPOUND: ["chatId", "messageIdWithChatId"],
    DM_THREAD_MESSAGES: "chatId",
    DM_THREAD_MESSAGES_COMPOUND: ["chatId", "threadId"],
    GM_CHATS: "TSLastMessage",
    GM_MESSAGES: "chatId",
    GM_MESSAGES_COMPOUND: ["chatId", "messageIdWithChatId"],
    GM_THREAD_MESSAGES: "chatId",
    GM_THREAD_MESSAGES_COMPOUND: ["chatId", "threadId"],
    TASKS: "projectId",
};
