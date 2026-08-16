// The page-side half of reminder delivery.
//
// A reminder is the ONE notification with no in-app channel. Everything else
// is routed from a socket event by `notificationRouter`, which raises a toast
// when the tab is visible and an OS card when it is not. A reminder is filed
// by a backend cron (`message_reminder_tick`) with no acting client to relay
// it, so no socket event exists and the router never sees one: Web Push was
// its only channel. When a browser's push subscription is dead — pruned
// server-side after a 410, or 403-ing since a key rotation — the reminder
// simply never arrived, which is exactly what a laptop reported while the
// same account's phone was notified fine.
//
// Push being unreliable on a given device is not something the page can
// detect (`getSubscription()` happily returns a subscription the push service
// has stopped honouring), so this does not try to. `useInboxResync` notices
// the inbox row the cron filed and calls this, unconditionally.
//
// Which means two cards can be produced for one reminder — this one and the
// server's push, on a device where push does work. They are collapsed into
// one by a shared notification `tag`, NOT by suppressing either side:
//
//   * `NotificationManager.notify` passes `intent.id` as the `tag`;
//   * the server pushes with `tag=f"{kind}:{reminder.id}"`
//     (`message_reminders.fire` / `todo_reminders.fire`);
//   * so `reminderIntentId` below reconstructs that exact string from the
//     inbox item's optionals, and whichever card is second REPLACES the
//     first instead of stacking beside it.
//
// Keep those two formats identical — the shared string is the entire
// de-duplication mechanism. This is the same arrangement `agentRunNotice.ts`
// uses, and for the same reason: the server applies gates the page cannot
// observe, so deferring to the push (by listing the category in the
// manager's `PUSH_COVERED_CATEGORIES`) would mean silence whenever one of
// those gates bit. Reminders are deliberately absent from that set.

import { fmt, getMessages } from "../../i18n";
import type { InboxItemProps } from "../../types/common";
import type { NotificationManager } from "./notificationManager";
import { openAppUrl } from "./openAppUrl";
import type { NotificationDispatch } from "./types";

/** `InboxItems.item_type` for a fired reminder — of a message OR a to-do.
 *  One type for both; `item_optionals.kind` discriminates. Mirrors
 *  `message_reminders.ITEM_TYPE_MESSAGE_REMINDER` /
 *  `todo_reminders.ITEM_TYPE_REMINDER`. */
export const ITEM_TYPE_REMINDER = 9;

/** The two `item_optionals.kind` values, which are ALSO the notification
 *  category keys (`categories.ts`) and the server's push-tag prefixes. That
 *  three-way coincidence is load-bearing for the dedupe, so the kinds are
 *  read straight through rather than mapped. */
const REMINDER_KINDS = ["message_reminder", "todo_reminder"] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

// Same public path the service worker hardcodes as its push-card icon, and
// for the same reason as in `agentRunNotice.ts`: a reminder can be announced
// by either side, and a hashed bundle URL would render one feature two ways.
const APP_ICON_URL = "/icons/icon-192.png";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const reminderKindOf = (item: InboxItemProps): ReminderKind | null => {
    const kind = asString(item.itemOptionals?.kind);
    return REMINDER_KINDS.includes(kind as ReminderKind) ? (kind as ReminderKind) : null;
};

const reminderIdOf = (item: InboxItemProps): string => asString(item.itemOptionals?.reminder_id);

/** True for an inbox row that is a fired reminder we can notify about.
 *  Narrow rather than trusting `itemType` alone: the optionals are what
 *  carry the reminder id, and without one there is no tag to dedupe on. */
export const isReminderItem = (item: InboxItemProps): boolean =>
    item.itemType === ITEM_TYPE_REMINDER && reminderKindOf(item) !== null && !!reminderIdOf(item);

/**
 * The notification id/tag for a fired reminder — `"<kind>:<reminder_id>"`.
 *
 * MUST stay byte-identical to the server's push `tag`. Per reminder rather
 * than per message or per to-do, because two reminders about the same subject
 * are two separate moments and must not collapse into one card.
 */
export const reminderIntentId = (item: InboxItemProps): string | null => {
    const kind = reminderKindOf(item);
    const reminderId = reminderIdOf(item);
    if (!kind || !reminderId) return null;
    return `${kind}:${reminderId}`;
};

/** Does this notification `tag` belong to a fired reminder?
 *
 *  Used to tell a reminder push apart from every other push without a payload
 *  field for it: the server sends no `category` in the push JSON
 *  (`webpush_dispatch`), and the tag prefix is the only thing that says what
 *  arrived. Requires a non-empty id after the colon so a bare `"todo_reminder"`
 *  — which would carry no reminder to identify — doesn't pass. */
export const isReminderTag = (tag: string): boolean =>
    REMINDER_KINDS.some((kind) => tag.startsWith(`${kind}:`) && tag.length > kind.length + 1);

/**
 * Announce a reminder that has come due.
 *
 * `item` is the inbox row the cron filed, already synced into IndexedDB —
 * so the title and body are composed from its `item_optionals`, in the
 * reader's language, rather than from the English `item_body` the server
 * stores as a fallback for clients that can't read optionals.
 *
 * Returns the manager's verdict for callers and tests. `"ignored-disabled"`
 * (the user turned To-do reminders off) and `"ignored-duplicate"` (this
 * reminder was already announced) are both normal outcomes, not failures.
 */
export const notifyReminderDue = (
    manager: NotificationManager | null | undefined,
    item: InboxItemProps
): NotificationDispatch | null => {
    if (!manager) return null;
    const kind = reminderKindOf(item);
    const id = reminderIntentId(item);
    if (!kind || !id) return null;

    const t = getMessages().services.notifications.reminder;
    const optionals = item.itemOptionals ?? {};
    const preview = asString(optionals.preview);
    const senderName = asString(optionals.sender_name);
    const href = asString(optionals.href);

    const title =
        kind === "todo_reminder"
            ? t.todoTitle
            : senderName
              ? fmt(t.messageTitle, { name: senderName })
              : t.messageTitleNoSender;

    return manager.notify({
        // Doubles as the browser notification `tag`; see the module comment.
        id,
        // The kind IS the category key — both are registered in
        // `categories.ts` under the `inbox` master, so a user can silence
        // to-do nagging without silencing flagged-message reminders. (No
        // cast: `ReminderKind` is a subset of `NotificationCategory`, and
        // it should stay a type error if that ever stops being true.)
        category: kind,
        title,
        body: preview || t.bodyFallback,
        // A reminder has no human actor to show — the person who asked for it
        // is the person being notified — so the Genos mark stands in, as it
        // does for a finished agent run.
        icon: APP_ICON_URL,
        // NB: `senderId` is deliberately unset even for a message reminder
        // whose `sender_name` we just used in the title. The manager drops
        // any intent whose sender is the current user, and reminding yourself
        // about your OWN message is a perfectly ordinary thing to have asked
        // for — stamping the sender would silence exactly those.
        onOpen: href ? () => openAppUrl(href) : undefined,
    });
};
