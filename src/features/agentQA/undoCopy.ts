// The words of Undo, in the person's language: what the control says, what its
// tooltip promises per tool, and one sentence per outcome and per refusal.
//
// The server's English `error` / `summary` never reach the screen when there is a
// code to localize: they are the fallback for an answer this client has no
// sentence for. Everything here is built from the `agentApproval.undo` catalog
// and is handed to the turn through `AgentTurnLabels.undo` (`agentTurnLabels.ts`),
// so the turn stays props-only and string-free.

import { fmt, type Messages } from "../../i18n";
import type { UndoAnswer, UndoRefusal, UndoSkippedField } from "../../services/agentApi";

export interface UndoLabels {
    // "Undo", and its accessible name per tool when a turn has several.
    button: string;
    buttonFor: string;
    undoing: string;
    retry: string;
    // "Undone": a restored write that was already undone.
    alreadyUndone: string;
    // The tooltip: what the click does for this tool, and that nothing already
    // sent is recalled.
    tooltip: (toolName: string) => string;
    // The status line of an undo that worked / of one that did not.
    outcome: (answer: UndoAnswer) => string;
    refusal: (refusal: UndoRefusal) => string;
}

type UndoMessages = Messages["agentApproval"]["undo"];

// A column name the server reports (`due_date`, `body`) as the person knows it.
// Title and body have no entry in `fieldLabels` (the approval previews never
// needed one), so Undo's own catalog names them.
export const undoFieldLabel = (t: Messages, field: string): string => {
    if (field === "title") return t.agentApproval.undo.fields.title;
    if (field === "body") return t.agentApproval.undo.fields.body;
    return (t.agentApproval.fieldLabels as Record<string, string>)[field] ?? field;
};

const listFields = (t: Messages, fields: readonly string[]): string =>
    fields.map((f) => undoFieldLabel(t, f)).join(t.agentApproval.undo.listSeparator);

const skippedFields = (skipped: readonly UndoSkippedField[]): string[] => [
    ...new Set(skipped.map((s) => s.field)),
];

export const undoOutcomeText = (t: Messages, answer: UndoAnswer): string => {
    const done: UndoMessages["done"] = t.agentApproval.undo.done;
    const entity = answer.entity;
    if (answer.action === "deleted") {
        if (entity?.kind === "task") {
            return entity.display_id
                ? fmt(done.deletedTask, { task: entity.display_id })
                : done.deletedTaskUnnamed;
        }
        if (entity?.kind === "note") {
            return entity.title
                ? fmt(done.deletedNote, { title: entity.title })
                : done.deletedNoteUnnamed;
        }
        if (entity?.kind === "comment") return done.deletedComment;
        return done.generic;
    }
    if (answer.restored.length === 0) return done.generic;
    const skipped = skippedFields(answer.skipped);
    if (skipped.length > 0) {
        return fmt(done.restoredSkipped, {
            fields: listFields(t, answer.restored),
            skipped: listFields(t, skipped),
        });
    }
    return fmt(done.restored, { fields: listFields(t, answer.restored) });
};

export const undoRefusalText = (t: Messages, refusal: UndoRefusal): string => {
    const refused: UndoMessages["refused"] = t.agentApproval.undo.refused;
    switch (refusal.code) {
        case "changed_since": {
            const fields = skippedFields(refusal.skipped);
            return fields.length > 0
                ? fmt(refused.changedSinceFields, { fields: listFields(t, fields) })
                : refused.changed_since;
        }
        case "not_found":
        case "not_undoable":
        case "already_undone":
        case "expired":
        case "permission_lost":
        case "throttled":
        case "unauthorized":
        case "network":
        case "server":
            return refused[refusal.code];
        default:
            // No sentence for this one: the server's own words, else the generic.
            return refusal.message || refused.unknown;
    }
};

export const undoTooltipText = (t: Messages, toolName: string): string => {
    const u = t.agentApproval.undo;
    const hint = (u.hints as Record<string, string>)[toolName] ?? u.hints.fallback;
    return `${hint} ${u.notRecalled}`;
};

/** The turn's Undo labels. Memoise on `t`: a new object per render would defeat the turn's memo. */
export const buildUndoLabels = (t: Messages): UndoLabels => ({
    button: t.agentApproval.undo.button,
    buttonFor: t.agentApproval.undo.buttonFor,
    undoing: t.agentApproval.undo.undoing,
    retry: t.agentApproval.undo.retry,
    alreadyUndone: t.agentApproval.undo.done.alreadyUndone,
    tooltip: (toolName) => undoTooltipText(t, toolName),
    outcome: (answer) => `${undoOutcomeText(t, answer)} ${t.agentApproval.undo.notRecalled}`,
    refusal: (refusal) => undoRefusalText(t, refusal),
});
