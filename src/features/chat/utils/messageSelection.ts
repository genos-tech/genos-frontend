// Text selected inside ONE chat message, and which message it is (MIP-1058: "Ask Genos" about a
// selected passage).
//
// A message body carries `data-ask-message-id="<v3 uuid>"` (`askMessageProps`), so a selection can be
// traced back to the message it lies in without any registry: the DOM already says. A selection counts
// only when BOTH of its ends are inside the SAME message body, so one that runs over a header, a
// toolbar, a reaction chip or into the next message is not offered (it names no single message, and
// its text would include what is not a message's words). A selection inside an editable field (a
// message being edited, the composer) is never offered either.
//
// This file only READS the selection; it never changes it, and holds no listener.

import { isMessageUuid } from "../../spotlight/askGenosAbout";

/** The attribute a message body wears. */
export const ASK_MESSAGE_ATTR = "data-ask-message-id";

/** The props that mark a message body as selectable-for-Ask, or none when the message has no v3 id
 *  (an optimistic row, an old cached row): a selection in it is not offered. */
export const askMessageProps = (id: string | null | undefined): Record<string, string> =>
    isMessageUuid(id) ? { [ASK_MESSAGE_ATTR]: id } : {};

export interface MessageSelection {
    /** The v3 id of the message the selection lies in. */
    messageId: string;
    /** What is selected, as the browser gives it (the caller trims and cuts it). */
    text: string;
    /** Where it is on screen, for placing a control next to it. */
    rect: DOMRect;
    /** The message body the selection lies in (to tell which list it belongs to). */
    body: Element;
}

const elementOf = (node: Node | null): Element | null =>
    node === null ? null : node.nodeType === 1 ? (node as Element) : node.parentElement;

const bodyOf = (node: Node | null): Element | null =>
    elementOf(node)?.closest(`[${ASK_MESSAGE_ATTR}]`) ?? null;

const inEditable = (node: Node | null): boolean =>
    elementOf(node)?.closest('input, textarea, [contenteditable="true"]') != null;

/** The current selection when it lies inside one message body, else null. `only` limits it to one
 *  message id (the "…" menu of a message asks about ITS selection only). */
export const readMessageSelection = (only?: string | null): MessageSelection | null => {
    const sel = typeof window === "undefined" ? null : window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const start = bodyOf(range.startContainer);
    if (!start || start !== bodyOf(range.endContainer)) return null;
    if (inEditable(range.startContainer) || inEditable(range.endContainer)) return null;
    const messageId = start.getAttribute(ASK_MESSAGE_ATTR);
    if (!isMessageUuid(messageId)) return null;
    if (only && only !== messageId) return null;
    const text = sel.toString();
    if (!text.trim()) return null;
    return { messageId, text, rect: range.getBoundingClientRect(), body: start };
};
