// Database constants
export const DB_NAME = "genosData";
// Bumped to 6: forces every browser through `initDB`'s upgrade callback
// so any database that was created at v5 *without* its object stores
// self-heals on next load. Previously, `BaseRepository.getDB` and
// `DatabaseUtils.*` called `openDB(name, version)` with no upgrade
// callback. Whichever entry point won the race on a fresh DB (most
// commonly `SignInForm`'s `clearTeamScopedStores()` running before
// `useAppInitialization` mounted) created the DB at v5 with zero
// stores; every later `openDB(name, 5)` then saw a matching version
// and silently skipped its upgrade, stranding the schema forever.
//
// Migration is still additive: the upgrade callback in ./schema.ts is
// idempotent — it only creates stores / indexes that don't already
// exist — so v4-or-correct-v5 databases re-enter the callback and
// emerge unchanged.
export const DB_VERSION = 6;

// LRU cap for the full-task cache (TASK_FULL store).
export const MAX_CACHED_FULL_TASKS = 500;

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
    MDM_CHATS: "mdmChats",
    MDM_MESSAGES: "mdmMessages",
    MDM_THREAD_MESSAGES: "mdmThreadMessages",
    PM_CHATS: "pmChats",
    PM_MESSAGES: "pmMessages",
    PM_THREAD_MESSAGES: "pmThreadMessages",
    FLAGGED_MESSAGES: "flaggedMessages",
    TASK_META: "taskMeta",
    TASK_FULL: "taskFull",
    PERSONAL_NOTES: "personalNotes",
    TASK_NOTES: "taskNotes",
    CHAT_NOTES: "chatNotes",
    TODOS: "todos",
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
    MDM_CHATS: "chatId",
    MDM_MESSAGES: "messageIdWithChatId",
    MDM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    PM_CHATS: "chatId",
    PM_MESSAGES: "messageIdWithChatId",
    PM_THREAD_MESSAGES: "messageIdWithChatIdAndThreadId",
    FLAGGED_MESSAGES: "flaggedMessageId",
    TASK_META: "id",
    TASK_FULL: "id",
    PERSONAL_NOTES: "noteId",
    TASK_NOTES: "noteId",
    CHAT_NOTES: "noteId",
    TODOS: "todoId",
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
    MDM_CHATS: "MdmTSLastMessageIndex",
    MDM_MESSAGES: "MdmMessagesIndex",
    MDM_MESSAGES_COMPOUND: "MdmMessagesCompoundIndex",
    MDM_THREAD_MESSAGES: "MdmThreadMessagesIndex",
    MDM_THREAD_MESSAGES_COMPOUND: "MdmThreadMessagesCompoundIndex",
    PM_CHATS: "PmTSLastMessageIndex",
    PM_MESSAGES: "PmMessagesIndex",
    PM_MESSAGES_COMPOUND: "PmMessagesCompoundIndex",
    PM_THREAD_MESSAGES: "PmThreadMessagesIndex",
    PM_THREAD_MESSAGES_COMPOUND: "PmThreadMessagesCompoundIndex",
    TASK_META: "TaskMetaIndex",
    TASK_META_COMPOUND: "TaskMetaCompoundIndex",
    TASK_META_ASSIGNEE: "TaskMetaAssigneeIndex",
    TASK_META_ASSIGNEE_PROJECT: "TaskMetaAssigneeProjectIndex",
    TASK_FULL_LRU: "TaskFullLRUIndex",
    PERSONAL_NOTES_OWNER: "PersonalNotesOwnerIndex",
    TASK_NOTES_OWNER: "TaskNotesOwnerIndex",
    TASK_NOTES_TASK: "TaskNotesTaskIndex",
    CHAT_NOTES_OWNER: "ChatNotesOwnerIndex",
    CHAT_NOTES_CHAT: "ChatNotesChatIndex",
    TODOS: "TodosUserIndex",
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
    MDM_CHATS: "TSLastMessage",
    MDM_MESSAGES: "chatId",
    MDM_MESSAGES_COMPOUND: ["chatId", "messageIdWithChatId"],
    MDM_THREAD_MESSAGES: "chatId",
    MDM_THREAD_MESSAGES_COMPOUND: ["chatId", "threadId"],
    PM_CHATS: "TSLastMessage",
    PM_MESSAGES: "chatId",
    PM_MESSAGES_COMPOUND: ["chatId", "messageIdWithChatId"],
    PM_THREAD_MESSAGES: "chatId",
    PM_THREAD_MESSAGES_COMPOUND: ["chatId", "threadId"],
    TASK_META: "projectId",
    TASK_META_COMPOUND: ["projectId", "status"],
    TASK_META_ASSIGNEE: "assigneeId",
    TASK_META_ASSIGNEE_PROJECT: ["assigneeId", "projectId"],
    TASK_FULL_LRU: "accessedAt",
    PERSONAL_NOTES_OWNER: "ownerId",
    TASK_NOTES_OWNER: "ownerId",
    TASK_NOTES_TASK: "taskId",
    CHAT_NOTES_OWNER: "ownerId",
    CHAT_NOTES_CHAT: "chatId",
    TODOS: "userId",
} as const;
