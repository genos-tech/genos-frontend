// Five master toggles the user can flip independently. Per-chat mute applies
// across all of them when the source chat is muted.
export type NotificationCategory =
    | "chats"
    | "thread_replies"
    | "mentions"
    | "task_comments"
    | "inbox";

export interface MutedChatRef {
    chatType: number;
    chatId: string;
}

export interface NotificationPreference {
    masterEnabled: boolean;
    enableChats: boolean;
    enableThreadReplies: boolean;
    enableMentions: boolean;
    enableTaskComments: boolean;
    enableInbox: boolean;
    mutedChats: MutedChatRef[];
}

// Default in-memory prefs used until the backend GET resolves. Designed so a
// freshly-loaded app behaves the same as the seeded backend defaults.
export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationPreference = {
    masterEnabled: true,
    enableChats: true,
    enableThreadReplies: true,
    enableMentions: true,
    enableTaskComments: true,
    enableInbox: true,
    mutedChats: [],
};

// What a websocket message becomes after `notificationRouter` decides it is
// notification-worthy. Pure data — the manager makes the
// foreground-vs-hidden / mute / dedupe decision from this.
export interface ActiveSurface {
    chatType?: number;
    chatId?: string;
    threadId?: number;
    taskId?: number;
    /** Project the source belongs to. Required to build the
     *  `/Home/tasks/project/:projectId/task/:taskId` deep URL when the user
     *  clicks a task-comment or PM-chat notification. */
    projectId?: number;
}

export interface NotificationIntent {
    /** Stable dedupe key, e.g. "chat:1:42:msg-7" or "inbox:99". */
    id: string;
    category: NotificationCategory;
    title: string;
    body: string;
    /** Sender avatar URL when known; used as the native notification icon. */
    icon?: string;
    /** Where this came from. Used for active-surface comparison and mute. */
    source?: ActiveSurface;
    /** User id of who triggered the event (used to skip self-notifications). */
    senderId?: string;
    /** Optional click handler. Currently fires `onOpenIntent` in the React layer. */
    onOpen?: () => void;
}

export type NotificationDispatch =
    | "ignored-self"
    | "ignored-disabled"
    | "ignored-muted"
    | "ignored-duplicate"
    | "ignored-active-surface"
    | "ignored-permission"
    | "toast"
    | "browser";
