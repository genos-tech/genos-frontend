// What the member answered on a report's task rows in this session (MIP-1211).
//
// The same task can sit in two sections of one card, in two reports, and Virtuoso unmounts a row
// that scrolls away. So "this row was quieted, here is its Undo" cannot live in a row's own
// state: answer a task on one card and every other card showing it must dim too, and a row
// scrolled away and back must still offer its Undo. Same shape as `inboxAiStore` (a tiny external
// store read with `useSyncExternalStore`): a row subscribes to its own key and re-renders only
// when ITS entry is replaced. Nothing here is persisted; the server holds the mark.
//
// The key is member, team and task. The member and team are in it because a mark is per member
// and per team, and one browser session can show two members or two teams in turn.

import type { Failure, MarkKey } from "../genos/memory/memoryApi";

/** The two answers a report row offers. Both are marks on the task. */
export type AnswerKey = "on_it" | "not_important";

export type AnswerPhase =
    /** Tapped, request in flight: the row is already dimmed. */
    | "saving"
    /** Saved: dimmed, with an Undo. */
    | "saved"
    /** Undo tapped, request in flight: the row is back to normal, its buttons wait. */
    | "undoing"
    /** The answer was refused: the row is normal, the reason is told in words. */
    | "failed"
    /** The Undo was refused: the answer stands, so the row stays dimmed. */
    | "undo-failed";

export type AnswerEntry = {
    phase: AnswerPhase;
    answer: AnswerKey;
    /** What Undo goes back to: the mark the answer replaced, or null (then Undo clears). */
    previous: MarkKey | null;
    /** Why the last request failed (`failed` and `undo-failed` only). */
    reason: Failure["reason"] | null;
};

const entries = new Map<string, AnswerEntry>();
const listeners = new Set<() => void>();

const emit = () => {
    for (const listener of [...listeners]) listener();
};

export const answerKey = (userId: string, teamId: string, taskId: number): string =>
    `${userId}|${teamId}|${taskId}`;

export const subscribeAnswers = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getAnswer = (key: string): AnswerEntry | undefined => entries.get(key);

/** A row whose answer stands (or is on its way): drawn dimmed. */
export const isDimmed = (entry: AnswerEntry | undefined): boolean =>
    entry !== undefined &&
    (entry.phase === "saving" || entry.phase === "saved" || entry.phase === "undo-failed");

export const setAnswer = (key: string, entry: AnswerEntry | null) => {
    if (entry === null) {
        if (!entries.delete(key)) return;
    } else entries.set(key, entry);
    emit();
};

/** Forget everything (a test, or the member signing out). */
export const resetAnswerStore = () => {
    entries.clear();
    emit();
};
