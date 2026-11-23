import type { ElementType } from "react";

import { fmt, type Messages } from "../../../i18n";
import type { InboxItemProps } from "../../../types/common";
import {
    MESSAGE_REMINDER,
    ReminderChatIcon,
    TODO_REMINDER_KIND,
    TodoReminderIcon,
} from "./inboxItemConfig";

export type ReminderParts = {
    headline: string;
    /** The subject itself, quoted: the message, or the to-do's title. */
    preview: string;
    href: string;
    openLabel: string;
    OpenIcon: ElementType;
};

/**
 * A reminder that came due (item type 9), composed from the optionals rather than the stored
 * `{title, text}` body: those facts are language-free, so a reminder set in English still reads
 * in Japanese, and the quote can be set apart from the sentence about it. Null for any other item.
 */
export const reminderParts = (
    item: Pick<InboxItemProps, "itemType" | "itemOptionals">,
    t: Messages
): ReminderParts | null => {
    if (item.itemType !== MESSAGE_REMINDER) return null;
    const optionals = item.itemOptionals;
    const sender = String(optionals?.sender_name ?? "");
    const chatName = String(optionals?.chat_name ?? "");
    // The to-do flavour shares the quote and the deep link (its `href` opens the To-Do pane on the
    // row); only the sentence and the link's wording differ.
    const isTodo = optionals?.kind === TODO_REMINDER_KIND;
    // A message reminder about a TASK COMMENT (`subject`, MIP-1444) is a message underneath, but
    // the card, and its open link, should say "comment". A to-do is checked first.
    const isComment = optionals?.subject === "task_comment";
    const s = t.inbox.messageReminder;
    const headline = isTodo
        ? t.inbox.todoReminder.headline
        : isComment
          ? sender
              ? fmt(s.headlineCommentFrom, { name: sender })
              : s.headlineComment
          : sender
            ? fmt(s.headlineFrom, { name: sender })
            : s.headline;
    const openLabel = isTodo
        ? t.inbox.todoReminder.openTodo
        : chatName
          ? fmt(s.openInNamed, { chat: chatName })
          : isComment
            ? s.openComment
            : s.openMessage;
    return {
        headline,
        preview: String(optionals?.preview ?? ""),
        href: String(optionals?.href ?? ""),
        openLabel,
        // What the link opens, not what reminded you.
        OpenIcon: isTodo ? TodoReminderIcon : ReminderChatIcon,
    };
};
