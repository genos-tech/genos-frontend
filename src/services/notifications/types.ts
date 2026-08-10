import type { NotificationCategory } from "./categories";

// The set of fine-grained category keys lives in `categories.ts` (the
// registry). `NotificationCategory` is derived from it; re-exported here so
// existing `import { NotificationCategory } from "./types"` sites keep working.
export type { NotificationCategory } from "./categories";

export interface MutedChatRef {
    chatType: number;
    chatId: string;
    /** Display name shown in the muted-chats settings list. Optional
     *  because legacy / freshly-hydrated entries from the backend may not
     *  yet carry a name; consumers should fall back to `chatId` when
     *  unset. */
    chatName?: string;
}

/** The kinds of object a per-object mute can target. `chat` overlaps the
 *  coarse `mutedChats` list intentionally — either matching is sufficient. */
export type MutedTargetType = "chat" | "thread" | "task" | "note";

/** A per-object mute. Identity is `(targetType, targetId)`; `categories`
 *  is a mutable attribute (scope), NOT part of identity. When `categories`
 *  is set the mute applies only to intents in those categories; when absent
 *  it mutes every category from that target. */
export interface MutedTargetRef {
    targetType: MutedTargetType;
    /** Always stored as a string; numeric source ids are normalized via
     *  `String(...)` at compare time. */
    targetId: string;
    /** Optional chat scope (used by `chat`/`thread` targets). */
    chatType?: number;
    /** Optional category scope. Empty/undefined = all categories. */
    categories?: NotificationCategory[];
    /** Optional display label for the settings list; falls back to id. */
    label?: string;
}

export interface NotificationPreference {
    masterEnabled: boolean;
    // Coarse group masters (hard-gate their sub-categories).
    enableChats: boolean;
    enableThreadReplies: boolean;
    enableMentions: boolean;
    enableTaskComments: boolean;
    enableInbox: boolean;
    /** Independent master for the EMAIL channel (sibling of the backend's
     *  `push_enabled`). Gates only email — in-app and push are untouched. */
    emailEnabled: boolean;
    /** Fine-grained per-category overrides layered on the coarse groups.
     *  `{ fineKey: boolean }`; an absent key inherits the category's
     *  `defaultEnabled`. Always PUT the FULL map (JSON field replace).
     *
     *  The map also carries the EMAIL channel's overrides under
     *  `email:`-prefixed keys — and those use the SERVER's category
     *  vocabulary (`email:mention_task`), not this client's finer one
     *  (`mention_task_body`/`mention_task_comment`), because the server is
     *  what reads them. See `emailCategories.ts`. */
    categorySettings: Record<string, boolean>;
    /** Coarse "mute whole chat" list. */
    mutedChats: MutedChatRef[];
    /** Fine per-object mute list (thread/task/note), optionally scoped. */
    mutedTargets: MutedTargetRef[];
    /** Slack-style "pause notifications" one-shot expiry — an absolute ISO
     *  instant (UTC). While `now < snoozeUntil` EVERYTHING is paused (in-app
     *  toasts here, push + email server-side). `null`/absent/past = no active
     *  one-shot pause. Cleared by PUTting explicit `null` (see `resume`). */
    snoozeUntil?: string | null;
    /** Recurring daily quiet window in the user's LOCAL wall-clock,
     *  overnight-capable (`start > end` spans midnight). `null`/absent or
     *  `enabled: false` = inactive. Evaluated in the zone `resolveDisplayZone`
     *  returns (`currentLocation > timezone`). */
    snoozeSchedule?: { enabled: boolean; start: string; end: string } | null;
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
    emailEnabled: true,
    categorySettings: {},
    mutedChats: [],
    mutedTargets: [],
    snoozeUntil: null,
    snoozeSchedule: null,
};

// What a websocket message becomes after `notificationRouter` decides it is
// notification-worthy. Pure data — the manager makes the
// foreground-vs-hidden / mute / dedupe decision from this.
export interface ActiveSurface {
    chatType?: number;
    chatId?: string;
    // Opaque, like `chatId`: a v3 thread-root id is a UUID string (legacy
    // numeric on old data). Consumers compare it with `===` / `String()`,
    // so both forms work; coercing to a number would drop the UUID.
    threadId?: number | string;
    taskId?: number;
    /** Project the source belongs to. Required to build the
     *  `/workspace/tasks/project/:projectId/task/:taskId` deep URL when the user
     *  clicks a task-comment or PM-chat notification. */
    projectId?: number;
    /** Note id for note-mention intents (surface_type 6/7/8). Populated
     *  explicitly by `buildActivityIntent` so per-object note muting does
     *  NOT have to read the overloaded `chatId` (which holds projectId for
     *  task-body mentions and noteId for note mentions). */
    noteId?: number;
    /** The activity surface namespace for activity-derived intents
     *  (chatType: 1/2/3 channel, 4 task comment, 5 task body, 6/7/8 notes).
     *  Carried for completeness / future per-surface matching. */
    surfaceType?: number;
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
    // Notifications are paused (Slack-style DND / snooze) — suppresses
    // everything while a one-shot `snoozeUntil` or a recurring
    // `snoozeSchedule` window is active.
    | "ignored-paused"
    | "ignored-permission"
    // Hidden tab, but Web Push is active — the service worker owns the OS
    // notification (driven by a server push), so the page suppresses its
    // own to avoid double-notifying.
    | "ignored-push-owned"
    | "toast"
    | "browser";
