// "Ask Genos about this": the hand-off from a task or milestone menu to the
// app-level ask (the Cmd-K overlay, or the Genos page when it is on screen).
//
// The menus sit deep in the task views; the ask lives at the App root
// (`useSpotlight`). They meet through a window event, the same shape as the
// other cross-tree signals (`genos:task-touched`, ...), plus a small queue for
// the structured ref: the overlay is not mounted while closed, so the ref has
// to wait somewhere until the input that will send it exists.
//
// What the user gets is a draft that already holds `#PRJ-123 ` (the task as a
// mention) with the cursor after it, so they type the question and send. The
// ask carries the task through the ordinary structured-mention path: the
// server resolves it by id and checks the person's access, exactly as for a
// task picked from the `#` menu. Nothing is sent until they press Ask.

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
