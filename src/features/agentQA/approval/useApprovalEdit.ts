// The edit state of ONE pending approval card.
//
// What it holds: whether the card is in edit mode, the editors' drafts, which
// date inputs hold half a date, and the server's sentences from a refused
// attempt. What it hands out: per field, the value, whether it changed, the
// cheap-check problem, and the patch to send: ONLY the fields that changed.
//
// A field is "changed" when the person moved it away from what its editor
// STARTED with (the proposal as the input shows it), not when it differs from
// the raw proposal: a reminder the model wrote as `2026-11-06` starts as
// `2026-11-06T09:00`, and an untouched one must not turn into an edit.
//
// The card remounts after a refused attempt (the turn swaps it for the spinner
// while the request is in flight), so a refusal comes back as props
// (`restoredEdits`, `fieldErrors`) and this hook starts from them: in edit
// mode, on what the person had typed, with the sentences next to the fields.

import { useCallback, useMemo, useState } from "react";

import {
    checkDraft,
    editableFieldsOf,
    initialDraft,
    sameDraft,
    valueAt,
    type Draft,
    type EditableField,
    type FieldProblem,
} from "./editableFields";

export interface ApprovalEditArgs {
    tool: string;
    args: Record<string, unknown>;
    editable: readonly string[] | undefined;
    // The sentence per path from a 422, and the patch that was refused.
    fieldErrors?: Record<string, string> | null;
    restoredEdits?: Record<string, unknown> | null;
}

export interface ApprovalEdit {
    /** The editors this card can show (the server's `editable`, minus paths this client has no editor for). */
    fields: EditableField[];
    editing: boolean;
    start: () => void;
    cancel: () => void;
    value: (path: string) => Draft;
    /** The value the editor started with. */
    initial: (path: string) => Draft;
    /** The raw value the card was sent, for "Genos proposed: ...". */
    original: (path: string) => unknown;
    set: (path: string, value: Draft, unreadable?: boolean) => void;
    reset: (path: string) => void;
    isDirty: (path: string) => boolean;
    problem: (path: string) => FieldProblem | null;
    /** The server's sentence for this path, until the person touches the field. */
    serverError: (path: string) => string | undefined;
    /** Server sentences for paths that have no editor on this card. */
    unplaced: Array<[string, string]>;
    /** Whether a server refusal is on show (even if no field is left to place it on). */
    refused: boolean;
    /** `{path: value}` of the changed fields only. */
    patch: Record<string, unknown>;
    changeCount: number;
    /** A changed field fails the cheap check: Approve stays off. */
    blocked: boolean;
}

export const useApprovalEdit = ({
    tool,
    args,
    editable,
    fieldErrors,
    restoredEdits,
}: ApprovalEditArgs): ApprovalEdit => {
    const timeZone = typeof args.time_zone === "string" ? args.time_zone : undefined;
    const fields = useMemo(() => editableFieldsOf(tool, editable), [tool, editable]);

    const initials = useMemo(() => {
        const out: Record<string, Draft> = {};
        for (const f of fields)
            out[f.path] = initialDraft(f.spec, valueAt(args, f.path), timeZone);
        return out;
    }, [fields, args, timeZone]);

    const [editing, setEditing] = useState(
        () => Boolean(fieldErrors) || Object.keys(restoredEdits ?? {}).length > 0
    );
    // Only the fields the person moved off their starting value.
    const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
        const out: Record<string, Draft> = {};
        for (const f of editableFieldsOf(tool, editable)) {
            const typed = restoredEdits?.[f.path];
            if (typeof typed === "string" || Array.isArray(typed)) {
                const draft = Array.isArray(typed) ? typed.map(String) : typed;
                const start = initialDraft(f.spec, valueAt(args, f.path), timeZone);
                if (!sameDraft(draft, start)) out[f.path] = draft;
            }
        }
        return out;
    });
    const [unreadable, setUnreadable] = useState<Record<string, true>>({});
    const [serverErrors, setServerErrors] = useState<Record<string, string>>(
        () => fieldErrors ?? {}
    );
    // The "can't be applied" notice stays up until the person cancels the edit
    // or the card is replaced (the next attempt unmounts it).
    const [refused, setRefused] = useState(() => Boolean(fieldErrors));

    const initial = useCallback((path: string): Draft => initials[path] ?? "", [initials]);
    const isDirty = useCallback(
        (path: string) => path in drafts || path in unreadable,
        [drafts, unreadable]
    );
    const value = useCallback(
        (path: string): Draft => (path in drafts ? drafts[path] : initial(path)),
        [drafts, initial]
    );

    const set = useCallback(
        (path: string, next: Draft, bad = false) => {
            setDrafts((prev) => {
                const copy = { ...prev };
                if (sameDraft(next, initials[path] ?? "")) delete copy[path];
                else copy[path] = next;
                return copy;
            });
            setUnreadable((prev) => {
                if (bad === path in prev) return prev;
                const copy = { ...prev };
                if (bad) copy[path] = true;
                else delete copy[path];
                return copy;
            });
            // Touching a field takes its refusal off: it was about the old value.
            setServerErrors((prev) => {
                if (!(path in prev)) return prev;
                const copy = { ...prev };
                delete copy[path];
                return copy;
            });
        },
        [initials]
    );

    const reset = useCallback((path: string) => set(path, initials[path] ?? ""), [set, initials]);

    const start = useCallback(() => setEditing(true), []);
    const cancel = useCallback(() => {
        setEditing(false);
        setDrafts({});
        setUnreadable({});
        setServerErrors({});
        setRefused(false);
    }, []);

    const problem = useCallback(
        (path: string): FieldProblem | null => {
            const f = fields.find((x) => x.path === path);
            if (!f || !isDirty(path)) return null;
            return checkDraft(f.spec, value(path), path in unreadable);
        },
        [fields, isDirty, value, unreadable]
    );

    const original = useCallback((path: string) => valueAt(args, path), [args]);
    const serverError = useCallback((path: string) => serverErrors[path], [serverErrors]);

    const placed = useMemo(() => new Set(fields.map((f) => f.path)), [fields]);
    const unplaced = useMemo(
        () => Object.entries(serverErrors).filter(([path]) => !placed.has(path)),
        [serverErrors, placed]
    );

    const patch = useMemo(() => {
        const out: Record<string, unknown> = {};
        for (const f of fields) {
            if (f.path in drafts && !(f.path in unreadable)) out[f.path] = drafts[f.path];
        }
        return out;
    }, [fields, drafts, unreadable]);

    const changeCount = useMemo(
        () => fields.filter((f) => f.path in drafts || f.path in unreadable).length,
        [fields, drafts, unreadable]
    );
    const blocked = useMemo(
        () =>
            fields.some(
                (f) =>
                    (f.path in drafts || f.path in unreadable) &&
                    checkDraft(
                        f.spec,
                        f.path in drafts ? drafts[f.path] : (initials[f.path] ?? ""),
                        f.path in unreadable
                    ) !== null
            ),
        [fields, drafts, unreadable, initials]
    );

    return {
        fields,
        editing,
        start,
        cancel,
        value,
        initial,
        original,
        set,
        reset,
        isDirty,
        problem,
        serverError,
        unplaced,
        refused,
        patch,
        changeCount,
        blocked,
    };
};
