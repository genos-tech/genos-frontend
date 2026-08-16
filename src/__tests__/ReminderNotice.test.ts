// The page-side notification for a reminder that came due.
//
// Reminders shipped with Web Push as their ONLY channel — the router that
// gives every other notification an in-app toast never sees them, because a
// cron files them with no acting client to relay a socket event. A device
// whose push subscription had quietly stopped working therefore got nothing
// at all, which is what a laptop did while the same account's phone was fine.
//
// `reminderNotice` is the missing channel, and these tests pin the two things
// that make adding it safe rather than noisy:
//
//   1. It composes from `item_optionals` (facts) rather than the stored
//      English `item_body`, so the card reads in the reader's language.
//   2. Its intent `id` is byte-identical to the server's push `tag`. That
//      shared string is the ENTIRE de-duplication mechanism between this card
//      and an OS card for the same reminder — get it wrong and the user sees
//      two. The literals asserted here are the contract with
//      `message_reminders.fire` / `todo_reminders.fire` in genos-api.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationManager } from "../services/notifications/notificationManager";
import {
    isReminderItem,
    isReminderTag,
    notifyReminderDue,
    reminderIntentId,
} from "../services/notifications/reminderNotice";
import type { InboxItemProps } from "../types/common";

const makeManager = () => {
    const manager = new NotificationManager({ currentUserId: "me" });
    return { manager, notify: vi.spyOn(manager, "notify") };
};

const todoItem = (overrides: Partial<InboxItemProps> = {}): InboxItemProps => ({
    itemId: 1,
    itemBody: [],
    itemType: 9,
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-08-16T09:00:00Z",
    itemOptionals: {
        kind: "todo_reminder",
        reminder_id: "77",
        todo_item_id: "42",
        preview: "Renew the domain",
        href: "/workspace/todo/2026-08-16/item/42",
        remind_at: "2026-08-16T09:00:00Z",
    },
    ...overrides,
});

const messageItem = (optionals: Record<string, unknown> = {}): InboxItemProps =>
    todoItem({
        itemId: 2,
        itemOptionals: {
            kind: "message_reminder",
            reminder_id: "88",
            sender_name: "Dana",
            preview: "can you look at the invoice?",
            href: "/workspace/chat/9",
            remind_at: "2026-08-16T09:00:00Z",
            ...optionals,
        },
    });

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe("reminderIntentId — the shared tag", () => {
    it("is `<kind>:<reminder_id>`, matching the server's push tag", () => {
        // These exact strings are built by `schedule_push_for_reminder(
        // tag=f"todo_reminder:{reminder.id}")` in genos-api. If either side
        // changes format, a reminder produces two cards instead of one.
        expect(reminderIntentId(todoItem())).toBe("todo_reminder:77");
        expect(reminderIntentId(messageItem())).toBe("message_reminder:88");
    });

    it("is per REMINDER, not per subject", () => {
        // Two reminders on the same to-do are two separate moments. Keying on
        // the to-do would collapse the second card into the first.
        const first = reminderIntentId(todoItem());
        const second = reminderIntentId(
            todoItem({
                itemId: 3,
                itemOptionals: { kind: "todo_reminder", reminder_id: "78", todo_item_id: "42" },
            })
        );
        expect(first).not.toBe(second);
    });

    it("is null when there is no reminder to identify", () => {
        expect(reminderIntentId(todoItem({ itemOptionals: null }))).toBeNull();
        expect(
            reminderIntentId(todoItem({ itemOptionals: { kind: "todo_reminder" } }))
        ).toBeNull();
        expect(
            reminderIntentId(todoItem({ itemOptionals: { kind: "digest", reminder_id: "1" } }))
        ).toBeNull();
    });
});

describe("isReminderItem", () => {
    it("accepts both kinds of fired reminder", () => {
        expect(isReminderItem(todoItem())).toBe(true);
        expect(isReminderItem(messageItem())).toBe(true);
    });

    it("rejects other inbox types even with reminder-shaped optionals", () => {
        expect(isReminderItem(todoItem({ itemType: 0 }))).toBe(false);
    });

    it("rejects a type-9 row with nothing to dedupe on", () => {
        // Without a reminder id there is no tag, so a card raised for it could
        // not be collapsed against the server's push. Better to stay quiet.
        expect(isReminderItem(todoItem({ itemOptionals: { kind: "todo_reminder" } }))).toBe(false);
    });
});

describe("isReminderTag — telling a reminder push from every other push", () => {
    it("accepts the server's reminder tags", () => {
        expect(isReminderTag("todo_reminder:77")).toBe(true);
        expect(isReminderTag("message_reminder:88")).toBe(true);
    });

    it("rejects every other push tag", () => {
        // The push payload carries no `category`, so the tag prefix is the
        // only signal. A false positive here means an inbox delta request per
        // backgrounded DM.
        expect(isReminderTag("mention_chat:12")).toBe(false);
        expect(isReminderTag("agent_run_done:run-7")).toBe(false);
        expect(isReminderTag("")).toBe(false);
    });

    it("rejects a prefix with no id after it", () => {
        expect(isReminderTag("todo_reminder:")).toBe(false);
        expect(isReminderTag("todo_reminder")).toBe(false);
    });
});

describe("notifyReminderDue", () => {
    it("raises a to-do reminder under its own category, tagged for dedupe", () => {
        const { manager, notify } = makeManager();
        notifyReminderDue(manager, todoItem());

        expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "todo_reminder:77",
                category: "todo_reminder",
                body: "Renew the domain",
                icon: "/icons/icon-192.png",
            })
        );
    });

    it("names the sender for a message reminder", () => {
        const { manager, notify } = makeManager();
        notifyReminderDue(manager, messageItem());

        const intent = notify.mock.calls[0][0];
        expect(intent.id).toBe("message_reminder:88");
        expect(intent.category).toBe("message_reminder");
        expect(intent.title).toContain("Dana");
        expect(intent.body).toBe("can you look at the invoice?");
    });

    it("still has a title when the sender is unknown", () => {
        const { manager, notify } = makeManager();
        notifyReminderDue(manager, messageItem({ sender_name: "" }));
        expect(notify.mock.calls[0][0].title).toBeTruthy();
    });

    it("still has a body when there is no preview to quote", () => {
        // A message whose only content was an attachment, or an empty to-do.
        const { manager, notify } = makeManager();
        notifyReminderDue(manager, messageItem({ preview: "" }));
        expect(notify.mock.calls[0][0].body).toBeTruthy();
    });

    it("never stamps senderId, or the manager would drop it as self", () => {
        // The person who asked to be reminded IS the recipient, and reminding
        // yourself about your own message is ordinary. Stamping the sender
        // would silence exactly those.
        const { manager, notify } = makeManager();
        notifyReminderDue(manager, messageItem({ sender_name: "Me" }));
        expect(notify.mock.calls[0][0].senderId).toBeUndefined();
    });

    it("is a real dispatch, not swallowed as a push-covered category", () => {
        // The whole fix depends on `message_reminder`/`todo_reminder` staying
        // OUT of `PUSH_COVERED_CATEGORIES`: a covered category on a hidden tab
        // defers to the service worker, which is the silence being fixed.
        const { manager } = makeManager();
        manager.setPushActive(true);
        vi.spyOn(document, "visibilityState", "get").mockReturnValue(
            "hidden" as DocumentVisibilityState
        );
        expect(notifyReminderDue(manager, todoItem())).not.toBe("ignored-push-owned");
    });

    it("respects the user turning that category off", () => {
        const { manager } = makeManager();
        manager.setSubCategoryEnabled("todo_reminder", false);
        expect(notifyReminderDue(manager, todoItem())).toBe("ignored-disabled");
    });

    it("does nothing without a manager or without a reminder id", () => {
        expect(notifyReminderDue(null, todoItem())).toBeNull();
        const { manager, notify } = makeManager();
        expect(notifyReminderDue(manager, todoItem({ itemOptionals: null }))).toBeNull();
        expect(notify).not.toHaveBeenCalled();
    });
});
