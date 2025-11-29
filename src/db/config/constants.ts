// Database constants
export const DB_NAME = "originData";
export const DB_VERSION = 18;

// Store names
export const STORES = {
    USER_INFO: "users",
    INBOX: "inbox",
    ACTIVITY_MESSAGES: "activityMessages",
    DM_CHATS: "dmChats",
    DM_MESSAGES: "dmMessages",
    DM_THREAD_MESSAGES: "dmThreadMessages",
    GM_CHATS: "gmChats",
    GM_MESSAGES: "gmMessages",
    GM_THREAD_MESSAGES: "gmThreadMessages",
    PM_CHATS: "pmChats",
    PM_MESSAGES: "pmMessages",
    PM_THREAD_MESSAGES: "pmThreadMessages",
    FLAGGED_MESSAGES: "flaggedMessages",
    TASKS: "tasks",
    PERSONAL_NOTES: "personalNotes",
    TASK_NOTES: "taskNotes",
    CHAT_NOTES: "chatNotes",
} as const;

// Key paths for object stores
export const KEY_PATHS = {
    USER_INFO: "userId",
    INBOX: "itemId",
    ACTIVITY_MESSAGES: "activityId",
    DM_CHATS: "chatId",
    DM_MESSAGES: "messageIdWithChatId",
    DM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    GM_CHATS: "chatId",
    GM_MESSAGES: "messageIdWithChatId",
    GM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    PM_CHATS: "chatId",
    PM_MESSAGES: "messageIdWithChatId",
    PM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    FLAGGED_MESSAGES: "flaggedMessageId",
    TASKS: "id",
    PERSONAL_NOTES: "noteId",
    TASK_NOTES: "noteId",
    CHAT_NOTES: "noteId",
} as const;

// Index names
export const INDEX_NAMES = {
    USER_INFO: "UserInfoIndex",
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
    PM_CHATS: "PmTSLastMessageIndex",
    PM_MESSAGES: "PmMessagesIndex",
    PM_MESSAGES_COMPOUND: "PmMessagesCompoundIndex",
    PM_THREAD_MESSAGES: "PmThreadMessagesIndex",
    PM_THREAD_MESSAGES_COMPOUND: "PmThreadMessagesCompoundIndex",
    TASKS: "TasksIndex",
    TASKS_COMPOUND: "TasksCompoundIndex",
} as const;

// Index key paths
export const INDEX_KEY_PATHS = {
    USER_INFO: "teamId",
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
    PM_CHATS: "TSLastMessage",
    PM_MESSAGES: "chatId",
    PM_MESSAGES_COMPOUND: ["chatId", "messageIdWithChatId"],
    PM_THREAD_MESSAGES: "chatId",
    PM_THREAD_MESSAGES_COMPOUND: ["chatId", "threadId"],
    TASKS: "projectId",
    TASKS_COMPOUND: ["projectId", "status"],
} as const;
