// The two answers on a report row, and Undo (MIP-1211). Both are the existing memory marks
// (MIP-1088): "On it" is the mark `on_it` (quiet for 7 days), "Not important" the mark
// `not_important` (out of top items and suggestions until cleared; the task returns in
// reports when it changes). The server decides what each means; this only sends the mark.
//
// Optimistic: the row dims the moment it is tapped (`saving`) and the request runs behind it.
// A refusal puts the row back and the store says why. Undo goes back to the mark the answer
// replaced (`previous`, from the server's own reply), or clears when there was none.
//
// The result lands in `inboxAnswerStore` by key, not in a component, so a row that unmounted
// meanwhile (Virtuoso) still gets its Undo.

import { writeMark } from "../../genos/memory/memoryApi";
import {
    answerKey,
    getAnswer,
    setAnswer,
    type AnswerEntry,
    type AnswerKey,
} from "../inboxAnswerStore";

type Who = { accessToken: string | null; userId: string; teamId: string; taskId: number };

/** Tap "On it" or "Not important". A second tap while one is in flight, or while an answer
 *  stands, is ignored: the buttons are not drawn then, and a double tap must not send twice. */
export const answerTask = async (who: Who, answer: AnswerKey): Promise<void> => {
    const key = answerKey(who.userId, who.teamId, who.taskId);
    const current = getAnswer(key);
    if (current && current.phase !== "failed") return;
    setAnswer(key, { phase: "saving", answer, previous: null, reason: null });
    const res = await writeMark(who.accessToken, who.teamId, who.taskId, answer, "report");
    if (!res.ok) {
        setAnswer(key, { phase: "failed", answer, previous: null, reason: res.reason });
        return;
    }
    setAnswer(key, { phase: "saved", answer, previous: res.data.previous, reason: null });
};

/** Undo a saved answer: back to the mark it replaced, or no mark. */
export const undoAnswer = async (who: Who): Promise<void> => {
    const key = answerKey(who.userId, who.teamId, who.taskId);
    const current = getAnswer(key);
    if (!current || (current.phase !== "saved" && current.phase !== "undo-failed")) return;
    const { answer, previous } = current;
    setAnswer(key, { phase: "undoing", answer, previous, reason: null });
    const res = await writeMark(who.accessToken, who.teamId, who.taskId, previous, "report");
    if (!res.ok) {
        const failed: AnswerEntry = { phase: "undo-failed", answer, previous, reason: res.reason };
        setAnswer(key, failed);
        return;
    }
    // Undone: the row is as the report drew it.
    setAnswer(key, null);
};
