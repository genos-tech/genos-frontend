// Database constants
export const DB_NAME = "genosData";
// Bumped to 9: adds the unified messaging stores (CHANNELS, CHANNEL_MEMBERS,
// MESSAGES_V3, MESSAGE_REACTIONS, READ_CURSORS, PINS, FLAGS,
// MESSAGE_ATTACHMENTS) used by the v3 rewrite. The legacy DM_* / GM_* /
// PM_* / MDM_* stores are NOT dropped in this version — they stay live
// so the legacy `useChatManagement` / message-handlers paths keep
// working while the new `useChannel` / `channelService` paths are wired
// in. A future version (v10) will drop the legacy stores once the FE
// rewrite is complete.
//
// Bumped to 8 (previous): the TODOS store's record shape changed from
// per-day ToDoFact to per-day ToDoGroup, so the keyPath moved from
// "todoId" to "groupId". The upgrade in ./schema.ts drops & recreates
// the TODOS store when oldVersion < 8 — cached entries from the old
// shape would otherwise be unreadable.
export const DB_VERSION = 9;

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
    SYNC_CHECKPOINTS: "syncCheckpoints",
    // ---- v9: unified messaging stores (see DB_VERSION docstring) ----
    // All keyed by server-issued UUIDs. Channel + thread membership is
    // tracked via FK indexes; PM "1 bubble per task" is a render-time
    // selector, not a storage shape (see plan §4).
    CHANNELS: "channels",
    CHANNEL_MEMBERS: "channelMembers",
    MESSAGES_V3: "messagesV3",
    MESSAGE_REACTIONS: "messageReactions",
    READ_CURSORS: "readCursors",
    PINS: "pins",
    FLAGS: "flags",
    MESSAGE_ATTACHMENTS: "messageAttachments",
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
    TODOS: "groupId",
    SYNC_CHECKPOINTS: "key",
    // ---- v9: unified messaging key paths ----
    // Every store keyed by the server-issued UUID. Compound indexes do
    // the per-channel scans.
    CHANNELS: "id",
    CHANNEL_MEMBERS: "id",
    MESSAGES_V3: "id",
    MESSAGE_REACTIONS: "id",
    READ_CURSORS: "id",
    PINS: "id",
    FLAGS: "id",
    MESSAGE_ATTACHMENTS: "id",
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
    // ---- v9: unified messaging indexes ----
    CHANNELS_BY_KIND: "ChannelsByKindIndex",
    CHANNEL_MEMBERS_BY_CHANNEL: "ChannelMembersByChannelIndex",
    CHANNEL_MEMBERS_BY_USER: "ChannelMembersByUserIndex",
    MESSAGES_V3_BY_CHANNEL: "MessagesV3ByChannelIndex",
    MESSAGES_V3_BY_CHANNEL_SEQ: "MessagesV3ByChannelSeqIndex",
    MESSAGES_V3_BY_THREAD_ROOT: "MessagesV3ByThreadRootIndex",
    MESSAGES_V3_BY_CHANNEL_TASK: "MessagesV3ByChannelTaskIndex",
    MESSAGE_REACTIONS_BY_MESSAGE: "MessageReactionsByMessageIndex",
    READ_CURSORS_BY_CHANNEL: "ReadCursorsByChannelIndex",
    PINS_BY_USER: "PinsByUserIndex",
    FLAGS_BY_USER: "FlagsByUserIndex",
    MESSAGE_ATTACHMENTS_BY_MESSAGE: "MessageAttachmentsByMessageIndex",
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
    // ---- v9: unified messaging index key paths ----
    CHANNELS_BY_KIND: "kind",
    CHANNEL_MEMBERS_BY_CHANNEL: "channelId",
    CHANNEL_MEMBERS_BY_USER: "userId",
    MESSAGES_V3_BY_CHANNEL: "channelId",
    // Compound: same channel, sorted by per-channel seq.
    MESSAGES_V3_BY_CHANNEL_SEQ: ["channelId", "seq"] as [string, string],
    MESSAGES_V3_BY_THREAD_ROOT: "threadRootId",
    // PM render-time selector: group by (channelId, metadata.taskId).
    // We index against metadata.taskId via a derived `taskKey` field
    // written by the writer (IDB indexes on JSON sub-paths aren't
    // supported in every browser).
    MESSAGES_V3_BY_CHANNEL_TASK: ["channelId", "taskKey"] as [string, string],
    MESSAGE_REACTIONS_BY_MESSAGE: "messageId",
    READ_CURSORS_BY_CHANNEL: "channelId",
    PINS_BY_USER: "userId",
    FLAGS_BY_USER: "userId",
    MESSAGE_ATTACHMENTS_BY_MESSAGE: "messageId",
} as const;
