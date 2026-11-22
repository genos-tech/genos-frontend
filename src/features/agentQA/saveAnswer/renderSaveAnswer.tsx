import type { ReactNode } from "react";

import type { AgentTurnActionContext } from "../AgentTurn";
import { SaveAnswerButtons, SaveAnswerStatus, type SaveProps } from "./SaveAnswerActions";
import { turnKeyOf } from "./saveAnswerStore";

/** A finished answer worth saving: text, no error, nothing still streaming or
 *  waiting on a decision, and a completed run behind it (a cancelled turn keeps
 *  its partial text but has no run id, and half an answer is not worth a note). */
export const canSaveAnswer = (ctx: AgentTurnActionContext): boolean =>
    !ctx.hasError &&
    !ctx.isStreaming &&
    !ctx.awaitingApproval &&
    Boolean(ctx.runId) &&
    ctx.answer.trim() !== "";

const propsOf = (ctx: AgentTurnActionContext): SaveProps => ({
    turnKey: turnKeyOf(ctx.runId, ctx.askedQuery, ctx.answer),
    askedQuery: ctx.askedQuery,
    answer: ctx.answer,
    answerSources: ctx.answerSources,
    sourcesById: ctx.sourcesById,
    onPreview: ctx.onPreview,
});

// MODULE-LEVEL, so every host hands `AgentTurn` the same two functions for ever: a
// finished turn re-renders for nothing because of them. The components they return
// are `memo`, keyed on values that only change when the turn itself does.
export const renderSaveAnswerActions = (ctx: AgentTurnActionContext): ReactNode =>
    canSaveAnswer(ctx) ? <SaveAnswerButtons {...propsOf(ctx)} /> : null;

export const renderSaveAnswerStatus = (ctx: AgentTurnActionContext): ReactNode =>
    canSaveAnswer(ctx) ? <SaveAnswerStatus {...propsOf(ctx)} /> : null;
