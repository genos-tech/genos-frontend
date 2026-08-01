// The EMAIL channel's category registry.
//
// Deliberately separate from `categories.ts`: email toggles are read by
// the SERVER (`origin/services/email_gating.py`), whose fine-category
// vocabulary is COARSER than this client's — the server has one
// `mention_task` where the client splits `mention_task_body` /
// `mention_task_comment`, one `mention_note` for the three note surfaces,
// and a `reactions` category with no client equivalent. An email toggle
// must therefore write `email:<SERVER key>` into `categorySettings`,
// never a client key.
//
// ⚠️ KEEP `emailDefault` IN SYNC with `_EMAIL_DEFAULTS` in
// genos-api `origin/services/email_gating.py` — if they drift, this panel
// lies about what will be sent. (Email defaults differ from push/in-app
// on purpose: email has no presence brake, so only "you were needed"
// categories default on.)

export const EMAIL_CATEGORY_PREFIX = "email:";

export interface EmailCategoryEntry {
    /** SERVER fine-category key (see the vocabulary note above). */
    readonly serverKey: string;
    /** i18n key under `t.services.notifications.emailCategories.<labelKey>`. */
    readonly labelKey: string;
    /** Server-side default when no `email:` override is stored. */
    readonly emailDefault: boolean;
}

// Display order. `task_assign` (email-only, nothing produces it yet) and
// `agent_run_done` (in-app-only by design) are deliberately absent —
// don't show switches for categories that can't currently email.
export const EMAIL_CATEGORIES: readonly EmailCategoryEntry[] = [
    { serverKey: "mention_chat", labelKey: "mentionChat", emailDefault: true },
    { serverKey: "mention_thread", labelKey: "mentionThread", emailDefault: true },
    { serverKey: "mention_task", labelKey: "mentionTask", emailDefault: true },
    { serverKey: "mention_note", labelKey: "mentionNote", emailDefault: true },
    { serverKey: "thread_replies", labelKey: "threadReplies", emailDefault: true },
    { serverKey: "task_comments", labelKey: "taskComments", emailDefault: true },
    { serverKey: "inbox", labelKey: "inbox", emailDefault: true },
    { serverKey: "chats", labelKey: "chats", emailDefault: false },
    { serverKey: "reactions", labelKey: "reactions", emailDefault: false },
];

/** Resolve an email category's effective on/off from stored prefs. */
export const isEmailCategoryEnabled = (
    categorySettings: Record<string, boolean>,
    entry: EmailCategoryEntry
): boolean => categorySettings[EMAIL_CATEGORY_PREFIX + entry.serverKey] ?? entry.emailDefault;
