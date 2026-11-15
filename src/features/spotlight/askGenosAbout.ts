// "Ask Genos about this": the hand-off from a menu or a button (a chat message,
// a calendar event) to the app-level ask (the Cmd-K overlay, or the Genos page
// when it is on screen). A task's and a milestone's own Ask used to come through
// here too; since MIP-1057 it opens that object's own conversation instead
// (`features/taskAsk`, `genos:ask-about-task`), and this hand-off, with the
// Cmd-K conversation, is not touched by it.
//
// The menus sit deep in the views; the ask lives at the App root
// (`useSpotlight`). They meet through a window event, the same shape as the
// other cross-tree signals (`genos:task-touched`, ...), plus a small queue for
// the structured ref: the overlay is not mounted while closed, so the ref has
// to wait somewhere until the input that will send it exists.
//
// What the user gets is a draft that already holds `#PRJ-123 ` (the thing as a
// mention) with the cursor after it, so they type the question and send. The
// ask carries it through the ordinary structured-mention path: the
// server resolves it by id and checks the person's access, exactly as for a
// task picked from the `#` menu. Nothing is sent until they press Ask.

import type { AskSelection } from "../agentQA/askSelection";
import { mentionKey, type AgentMentionRef } from "../agentQA/mentions/types";

export type AskGenosTaskRef = Extract<AgentMentionRef, { kind: "task" }>;

const EVENT_NAME = "genos:ask-about";

// Refs waiting for an input to adopt them (see `takePendingAskRefs`).
let pending: AgentMentionRef[] = [];

/** The mention for a task or a milestone (a milestone is its backing task), or
 *  null when there is nothing to name it by. The label is the display id when
 *  there is one, the same token `#MIP-739` a person types by hand. */
export const askGenosRefForTask = (task: {
    id: number | null | undefined;
    displayId?: string | null;
    title?: string | null;
    isMilestone?: boolean;
}): AskGenosTaskRef | null => {
    const id = task.id;
    if (id == null || !Number.isFinite(id) || id <= 0) return null;
    const label = (task.displayId ?? "").trim() || (task.title ?? "").trim();
    if (!label) return null;
    return { kind: "task", taskId: id, label, ...(task.isMilestone ? { isMilestone: true } : {}) };
};

export type AskGenosCalendarEventRef = Extract<AgentMentionRef, { kind: "calendar_event" }>;

// The longest label an event puts in the draft: a title can be a sentence, and the draft is a line
// the person is about to type a question after.
const EVENT_LABEL_MAX = 60;

/** The mention for a Google Calendar event (MIP-1059, AGENT_PARITY_TOOLS), or null when it cannot be
 *  named: the event needs its account, its calendar (the primary one when none is known) and its id.
 *  The label is the title on one line, `fallbackLabel` for an event with none. It is advisory on the
 *  wire: the server never puts it into a prompt, and reads nothing from Google at ask time. */
export const askGenosRefForCalendarEvent = (event: {
    accountId?: string | null;
    calendarId?: string | null;
    eventId?: string | null;
    summary?: string | null;
    fallbackLabel: string;
}): AskGenosCalendarEventRef | null => {
    const accountId = event.accountId?.trim();
    const eventId = event.eventId?.trim();
    if (!accountId || !eventId) return null;
    const title = (event.summary ?? "").replace(/\s+/g, " ").trim();
    // By code point, so an emoji or a CJK character is never cut in half.
    const chars = Array.from(title);
    const label =
        chars.length > EVENT_LABEL_MAX
            ? `${chars.slice(0, EVENT_LABEL_MAX - 1).join("")}…`
            : title;
    return {
        kind: "calendar_event",
        accountId,
        calendarId: event.calendarId?.trim() || "primary",
        eventId,
        label: label || event.fallbackLabel,
    };
};

export type AskGenosMessageRef = Extract<AgentMentionRef, { kind: "message" }>;

// The v3 message id is a UUID. Anything else (an optimistic row not yet saved, an old cached row in
// the legacy `${chatId}-${seq}` form, the per-channel sequence number) names no message the server
// could read, so it gets no Ask item at all rather than one that silently does nothing.
const MESSAGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `id` has the shape of a v3 `Message.id`. */
export const isMessageUuid = (id: unknown): id is string =>
    typeof id === "string" && MESSAGE_UUID.test(id);

// The longest a person's name may be in a draft token.
const MESSAGE_NAME_MAX = 30;

// Labels handed out in this session, label -> message id, so two messages never share a token: the
// draft finds a mention by its text, and a second message with the same label would otherwise be taken
// for the first ("already in the draft"). Bounded; the oldest goes first.
const issuedLabels = new Map<string, string>();
const ISSUED_LABELS_MAX = 200;

const uniqueMessageLabel = (label: string, id: string): string => {
    let candidate = label;
    for (let n = 2; issuedLabels.has(candidate) && issuedLabels.get(candidate) !== id; n += 1) {
        candidate = `${label} (${n})`;
    }
    issuedLabels.delete(candidate);
    issuedLabels.set(candidate, id);
    if (issuedLabels.size > ISSUED_LABELS_MAX) {
        const oldest = issuedLabels.keys().next().value;
        if (oldest !== undefined) issuedLabels.delete(oldest);
    }
    return candidate;
};

/** The mention for a chat message (MIP-1058, AGENT_PARITY_TOOLS), or null when it cannot be named:
 *  it needs its v3 id (`messageIdWithChatId` of a main-channel message,
 *  `messageIdWithChatIdAndThreadId` of a thread reply; NEVER the sequence `messageId`).
 *
 *  The label is what the draft shows (`#Alice 14:02 `), so it is the sender and the time, and
 *  deliberately NOT a piece of the message: the token is part of the question the member sends, and the
 *  server fences a message's text as other people's words (data, never instructions). A snippet in
 *  the token would put up to a line of someone else's text into the question, outside that fence.
 *  The name has `#`, `@` and line breaks taken out (a `#` inside would reopen the mention picker) and
 *  is cut by code point; two messages never share a label. */
export const askGenosRefForMessage = (message: {
    id: string | null | undefined;
    senderName?: string | null;
    tsSent?: string | null;
    locale?: string;
    /** The stand-in when there is no sender name (a translated word for "Message"). */
    fallbackLabel: string;
}): AskGenosMessageRef | null => {
    const id = message.id?.trim();
    if (!isMessageUuid(id)) return null;
    const name = Array.from((message.senderName ?? "").replace(/[#@\s]+/g, " ").trim())
        .slice(0, MESSAGE_NAME_MAX)
        .join("")
        .trim();
    let time = "";
    if (message.tsSent) {
        const at = new Date(message.tsSent);
        if (!Number.isNaN(at.getTime())) {
            try {
                time = new Intl.DateTimeFormat(message.locale, {
                    hour: "numeric",
                    minute: "2-digit",
                }).format(at);
            } catch {
                time = "";
            }
        }
    }
    const base = [name || message.fallbackLabel, time].filter(Boolean).join(" ").trim();
    return {
        kind: "message",
        messageId: id,
        label: uniqueMessageLabel(base, id),
    };
};

/** A message as the SOURCE of a selection (`selected_from`), or null without a v3 id. Not a draft
 *  token, so it has no label (the server never reads one) and takes none of the draft labels. */
export const askGenosSourceForMessage = (
    id: string | null | undefined
): AskGenosMessageRef | null => {
    const trimmed = id?.trim();
    return isMessageUuid(trimmed) ? { kind: "message", messageId: trimmed, label: "" } : null;
};

/** The text the draft gets for a ref. */
export const askGenosToken = (ref: AgentMentionRef): string => `#${ref.label} `;

/** `draft` with the token added: as it is if the token is already there, alone
 *  if the draft is empty, else after what the person had typed. */
export const withAskGenosToken = (draft: string, token: string): string => {
    if (draft.includes(token) || draft.trimEnd().endsWith(token.trimEnd())) return draft;
    if (draft.trim() === "") return token;
    return `${draft.trimEnd()} ${token}`;
};

/** Ask the app-level Genos about `ref`: opens it with the ref in the draft. */
export const requestAskGenosAbout = (ref: AgentMentionRef): void => {
    if (!pending.some((p) => mentionKey(p) === mentionKey(ref))) pending.push(ref);
    window.dispatchEvent(
        new CustomEvent<{ ref: AgentMentionRef }>(EVENT_NAME, { detail: { ref } })
    );
};

const SELECTION_EVENT_NAME = "genos:ask-about-selection";

/** Ask the app-level Genos about a passage of text the member selected (MIP-1058): it opens (or
 *  focuses) with the passage attached to the question. Nothing is sent until they press Ask. Unlike a
 *  ref this needs no queue: the passage is held by `useSpotlight`, which lives at the App root and is
 *  always there to take it. */
export const requestAskGenosAboutSelection = (selection: AskSelection): void => {
    window.dispatchEvent(
        new CustomEvent<{ selection: AskSelection }>(SELECTION_EVENT_NAME, {
            detail: { selection },
        })
    );
};

/** The listener for `requestAskGenosAboutSelection` (`useSpotlight`). */
export const onAskGenosAboutSelection = (
    handler: (selection: AskSelection) => void
): (() => void) => {
    const listener = (e: Event) => {
        const selection = (e as CustomEvent<{ selection?: AskSelection }>).detail?.selection;
        if (selection?.text) handler(selection);
    };
    window.addEventListener(SELECTION_EVENT_NAME, listener);
    return () => window.removeEventListener(SELECTION_EVENT_NAME, listener);
};

/** The listener (`useSpotlight`, which lives at the App root). */
export const onAskGenosAbout = (handler: (ref: AgentMentionRef) => void): (() => void) => {
    const listener = (e: Event) => {
        const ref = (e as CustomEvent<{ ref?: AgentMentionRef }>).detail?.ref;
        if (ref) handler(ref);
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};

/** The refs waiting for an input, handed over once. The input that takes them
 *  registers them as picked mentions, so the ask carries them even when the
 *  task is not in its candidate pool. */
export const takePendingAskRefs = (): AgentMentionRef[] => {
    if (pending.length === 0) return pending;
    const out = pending;
    pending = [];
    return out;
};
