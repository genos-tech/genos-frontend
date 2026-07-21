// Single source of truth for notification categories.
//
// Adding a finer category is a ONE-LINE change here (plus two i18n keys):
// the manager's enablement resolver, the router's category assignment, and
// the settings panel all read this registry instead of hard-coded switches.
//
// The five coarse `group` values ARE the legacy `NotificationPreference`
// boolean columns. A group acts as a master switch that *hard-gates* every
// sub-category under it (so an old client that turned `enableMentions` off
// still suppresses every `mention_*` key, regardless of `categorySettings`).

/** The five coarse groups == the legacy NotificationPreference boolean
 *  columns that act as master switches over their sub-categories. */
export type CoarseGroup = "chats" | "thread_replies" | "mentions" | "task_comments" | "inbox";

/** The NotificationPreference boolean field that backs each coarse group.
 *  Declared as a literal union (rather than importing NotificationPreference)
 *  to keep this module free of a type cycle with `types.ts`. */
export type CoarseField =
    | "enableChats"
    | "enableThreadReplies"
    | "enableMentions"
    | "enableTaskComments"
    | "enableInbox";

export interface CategoryEntry {
    /** Stable persisted key. NEVER rename — it lives in `categorySettings`
     *  and in `mutedTargets[].categories`. */
    readonly key: string;
    /** Coarse group == the boolean column that hard-gates this key. */
    readonly group: CoarseGroup;
    /** i18n key under `t.services.notifications.categories.<labelKey>`. */
    readonly labelKey: string;
    /** i18n key under
     *  `t.services.notifications.settings.categoryDescriptions.<descriptionKey>`. */
    readonly descriptionKey: string;
    /** Enablement used when `categorySettings` has no explicit entry for
     *  `key`. All ship `true` (notifications on by default — non-breaking). */
    readonly defaultEnabled: boolean;
    /** When false, the sub-category has no dedicated toggle row in the
     *  settings panel (the lone member of a single-sub group is driven by
     *  the group master alone). Defaults to shown. */
    readonly hideSubToggle?: boolean;
}

export const NOTIFICATION_CATEGORIES = [
    {
        key: "chats",
        group: "chats",
        labelKey: "chats",
        descriptionKey: "chats",
        defaultEnabled: true,
        hideSubToggle: true,
    },
    {
        key: "thread_replies",
        group: "thread_replies",
        labelKey: "threadReplies",
        descriptionKey: "threadReplies",
        defaultEnabled: true,
        hideSubToggle: true,
    },
    {
        key: "mention_chat",
        group: "mentions",
        labelKey: "mentionChat",
        descriptionKey: "mentionChat",
        defaultEnabled: true,
    },
    {
        key: "mention_thread",
        group: "mentions",
        labelKey: "mentionThread",
        descriptionKey: "mentionThread",
        defaultEnabled: true,
    },
    {
        key: "mention_task_body",
        group: "mentions",
        labelKey: "mentionTaskBody",
        descriptionKey: "mentionTaskBody",
        defaultEnabled: true,
    },
    {
        key: "mention_task_comment",
        group: "mentions",
        labelKey: "mentionTaskComment",
        descriptionKey: "mentionTaskComment",
        defaultEnabled: true,
    },
    {
        key: "mention_note_my",
        group: "mentions",
        labelKey: "mentionNoteMy",
        descriptionKey: "mentionNoteMy",
        defaultEnabled: true,
    },
    {
        key: "mention_note_task",
        group: "mentions",
        labelKey: "mentionNoteTask",
        descriptionKey: "mentionNoteTask",
        defaultEnabled: true,
    },
    {
        key: "mention_note_chat",
        group: "mentions",
        labelKey: "mentionNoteChat",
        descriptionKey: "mentionNoteChat",
        defaultEnabled: true,
    },
    {
        key: "task_comments",
        group: "task_comments",
        labelKey: "taskComments",
        descriptionKey: "taskComments",
        defaultEnabled: true,
        hideSubToggle: true,
    },
    {
        key: "inbox",
        group: "inbox",
        labelKey: "inbox",
        descriptionKey: "inbox",
        defaultEnabled: true,
    },
    {
        // Fired locally (never by the websocket router) when a Spotlight /
        // thread / note agent run finishes while its surface is closed —
        // see `agentRunNotice.ts`. Grouped under `inbox` deliberately: it is
        // a system notice addressed to just this user, and reusing the group
        // keeps it on the existing `enable_inbox` column instead of adding a
        // sixth coarse master (which would need a backend migration).
        key: "agent_run_done",
        group: "inbox",
        labelKey: "agentRunDone",
        descriptionKey: "agentRunDone",
        defaultEnabled: true,
    },
] as const satisfies readonly CategoryEntry[];

/** Union of every fine category key — derived from the registry so the
 *  manager/router stay exhaustive when an entry is added or removed. */
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export const CATEGORY_BY_KEY = NOTIFICATION_CATEGORIES.reduce(
    (acc, entry) => {
        acc[entry.key] = entry;
        return acc;
    },
    {} as Record<NotificationCategory, CategoryEntry>
);

/** Coarse group -> the NotificationPreference boolean field that hard-gates it. */
export const COARSE_FIELD: Record<CoarseGroup, CoarseField> = {
    chats: "enableChats",
    thread_replies: "enableThreadReplies",
    mentions: "enableMentions",
    task_comments: "enableTaskComments",
    inbox: "enableInbox",
};

const GROUP_ORDER: readonly CoarseGroup[] = [
    "chats",
    "thread_replies",
    "mentions",
    "task_comments",
    "inbox",
];

/** Display-ordered groups with their member sub-categories — used by the
 *  settings panel to render a group master switch + per-sub toggles. */
export const CATEGORY_GROUPS: ReadonlyArray<{
    group: CoarseGroup;
    field: CoarseField;
    entries: readonly CategoryEntry[];
}> = GROUP_ORDER.map((group) => ({
    group,
    field: COARSE_FIELD[group],
    entries: NOTIFICATION_CATEGORIES.filter((e) => e.group === group),
}));
