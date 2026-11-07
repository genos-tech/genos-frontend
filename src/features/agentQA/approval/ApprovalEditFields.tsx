// The editors of a pending approval card (edit before approve).
//
// One editor per editable field, by KIND (see `editableFields.ts`):
//
//   text     a single-line input; Enter does nothing (only the buttons approve)
//   body     a multiline textarea, plain text; a note body is markdown SOURCE,
//            there is deliberately no rich editor here
//   enum     a native <select> of the task meta constants
//   date     a native date input (value `YYYY-MM-DD`)
//   remindAt a native datetime-local input (the person's own time)
//   tags     the proposed tag names with remove, and a free-text add
//
// NATIVE controls on purpose. This card is mounted in the Spotlight overlay
// (z-index 13100, above every Joy popup layer), in the thread / note Joy
// modals and at 375px wide. A Joy `Select` listbox portals at a popup z-index
// far below the overlay and would open BEHIND it; a native <select> and the
// native date pickers are drawn by the browser, above everything, and are the
// right control on a phone.
//
// Every editor shows what Genos proposed once it has been changed ("Genos
// proposed: ..."), a Reset for that field, and its own problem sentence. The
// `Now: ...` snapshot the backend adds to some fields is shown only while the
// field is untouched: it was computed when the run paused and says nothing
// true about an edit.

import { useId, type KeyboardEvent, type ReactNode } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { Box, Button, Chip, ChipDelete, Typography } from "@mui/joy";

import { fmt, useTranslation, type Messages } from "../../../i18n";
import { focusRing, g } from "../../../theme/tokens";
import { taskMetaLabel } from "../../tasks/utils/taskMeta";
import {
    clipText,
    currentValue,
    enumOptions,
    showValue,
    type EditableField,
    type FieldSpec,
} from "./editableFields";
import type { ApprovalEdit } from "./useApprovalEdit";

const controlSx = (invalid: boolean) => ({
    width: "100%",
    boxSizing: "border-box" as const,
    font: "inherit",
    // 16px on a phone: smaller and iOS zooms the page when the field is focused.
    fontSize: { xs: "1rem", sm: "0.875rem" },
    px: 1,
    py: 0.625,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: invalid ? g.danger.text : g.border.default,
    background: g.surface.default,
    color: g.text.primary,
    "&:focus": {
        ...focusRing,
        outlineOffset: 0,
        borderColor: invalid ? g.danger.text : g.focus,
    },
});

type FieldLabels = Messages["agentApproval"]["edit"]["fields"];

/** A proposed or present value, as a person reads it. */
const useShowValue = () => {
    const { t } = useTranslation();
    return (spec: FieldSpec, v: unknown, timeZone?: string): string =>
        showValue(
            spec,
            v,
            {
                cleared: t.agentApproval.cleared,
                noTags: t.agentApproval.edit.noTags,
                meta: t.tasks.filters,
            },
            timeZone
        );
};

const Frame = ({
    controlId,
    label,
    wide,
    dirty,
    resetLabel,
    onReset,
    hints,
    error,
    errorId,
    children,
}: {
    controlId: string;
    label: string;
    wide: boolean;
    dirty: boolean;
    resetLabel: string;
    onReset: () => void;
    hints: string[];
    error?: string | null;
    errorId: string;
    children: ReactNode;
}) => {
    const { t } = useTranslation();
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                minWidth: 0,
                gridColumn: wide ? { xs: "1 / -1" } : undefined,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box
                    component="label"
                    htmlFor={controlId}
                    sx={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: g.text.secondary,
                    }}
                >
                    {label}
                </Box>
                {dirty ? (
                    <Button
                        aria-label={resetLabel}
                        size="sm"
                        startDecorator={<RestartAltRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{ minHeight: 0, py: 0, px: 0.5, fontSize: "0.75rem" }}
                        variant="plain"
                        onClick={onReset}
                    >
                        {t.agentApproval.edit.reset}
                    </Button>
                ) : null}
            </Box>
            {children}
            {hints.map((hint) => (
                <Typography
                    key={hint}
                    level="body-xs"
                    sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
                >
                    {hint}
                </Typography>
            ))}
            {/* Always in the DOM, so a message that appears while the person
                types is announced. */}
            <Typography
                aria-live="polite"
                id={errorId}
                level="body-xs"
                sx={{ color: g.danger.text, overflowWrap: "anywhere" }}
            >
                {error ?? ""}
            </Typography>
        </Box>
    );
};

const TagsEditor = ({
    id,
    value,
    onChange,
    describedBy,
    invalid,
}: {
    id: string;
    value: string[];
    onChange: (next: string[]) => void;
    describedBy: string;
    invalid: boolean;
}) => {
    const { t } = useTranslation();
    // The typed-but-not-added name lives in the input itself (uncontrolled), so
    // blur can add it: a name left in the box must not be lost silently.
    const commit = (input: HTMLInputElement) => {
        const name = input.value.trim();
        input.value = "";
        if (name && !value.includes(name)) onChange([...value, name]);
    };
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box
                aria-label={t.agentApproval.fieldLabels.tags}
                role="list"
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
            >
                {value.length === 0 ? (
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {t.agentApproval.edit.noTags}
                    </Typography>
                ) : null}
                {value.map((tag) => (
                    <Chip
                        key={tag}
                        role="listitem"
                        size="sm"
                        variant="soft"
                        endDecorator={
                            <ChipDelete
                                aria-label={fmt(t.agentApproval.edit.removeTag, { tag })}
                                onDelete={() => onChange(value.filter((v) => v !== tag))}
                            />
                        }
                    >
                        {tag}
                    </Chip>
                ))}
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
                <Box
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    component="input"
                    data-approval-field=""
                    id={id}
                    placeholder={t.agentApproval.edit.tagPlaceholder}
                    sx={controlSx(invalid)}
                    type="text"
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => commit(e.currentTarget)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        // Enter that confirms an IME conversion is not "add".
                        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                        e.preventDefault();
                        e.stopPropagation();
                        commit(e.currentTarget);
                    }}
                />
                <Button
                    size="sm"
                    startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    variant="outlined"
                    onClick={(e) => {
                        const input = e.currentTarget.parentElement?.querySelector("input");
                        if (input) commit(input);
                    }}
                >
                    {t.agentApproval.edit.addTag}
                </Button>
            </Box>
        </Box>
    );
};

interface EditorProps {
    edit: ApprovalEdit;
    field: EditableField;
    args: Record<string, unknown>;
    idPrefix: string;
    // A bulk row names its fields by the row, which the group heading carries.
    wide?: boolean;
}

/** One field: its label, control, Reset, hint and problem sentence. */
export const FieldEditor = ({ edit, field, args, idPrefix, wide }: EditorProps) => {
    const { t } = useTranslation();
    const show = useShowValue();
    const { path, spec } = field;
    const timeZone = typeof args.time_zone === "string" ? args.time_zone : undefined;

    const controlId = `${idPrefix}-${path.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    const errorId = `${controlId}-err`;
    const labelText = (t.agentApproval.edit.fields as FieldLabels)[spec.label];
    const dirty = edit.isDirty(path);
    const draft = edit.value(path);
    const problem = edit.problem(path);
    const serverError = edit.serverError(path);
    const message = problem
        ? fmt(t.agentApproval.edit.errors[problem], { field: labelText, max: spec.maxLength ?? 0 })
        : (serverError ?? null);
    const invalid = Boolean(message);

    // "Genos proposed" once changed, "Now" while untouched (and only if the
    // backend sent a snapshot for it).
    const hints: string[] = [];
    if (dirty) {
        // A body can be long: the hint is a caption, not a second copy of it.
        const proposed = show(spec, edit.original(path), timeZone);
        hints.push(
            fmt(t.agentApproval.edit.proposed, {
                value: spec.kind === "body" ? clipText(proposed) : proposed,
            })
        );
    } else {
        const now = currentValue(args, field.field, field.row);
        if (now.known) {
            hints.push(fmt(t.agentApproval.edit.now, { value: show(spec, now.value, timeZone) }));
        }
        // An empty proposal is the tool's "clear it": an empty box would not say so.
        if (spec.kind === "body" && edit.original(path) === "") {
            hints.push(fmt(t.agentApproval.edit.proposed, { value: t.agentApproval.cleared }));
        }
    }

    const common = {
        id: controlId,
        "aria-describedby": errorId,
        "aria-invalid": invalid || undefined,
        "data-approval-field": "",
    };
    const text = typeof draft === "string" ? draft : "";

    let control: ReactNode;
    switch (spec.kind) {
        case "text":
            control = (
                <Box
                    {...common}
                    component="input"
                    sx={controlSx(invalid)}
                    type="text"
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        edit.set(path, e.target.value)
                    }
                />
            );
            break;
        case "body":
            control = (
                <Box
                    {...common}
                    component="textarea"
                    rows={spec.label === "comment" ? 3 : 5}
                    value={text}
                    sx={{
                        ...controlSx(invalid),
                        resize: "vertical",
                        minHeight: 64,
                        maxHeight: 360,
                        lineHeight: 1.45,
                    }}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        edit.set(path, e.target.value)
                    }
                />
            );
            break;
        case "enum": {
            const options = enumOptions(spec.enumKind ?? "priority");
            const proposed = String(edit.initial(path));
            // A value outside the list (what the model sent, "Deleted" on a
            // status) stays selectable as what it is, so the select never
            // quietly shows a different value from the one that will run.
            const extra = proposed && !options.includes(proposed) ? proposed : null;
            control = (
                <Box
                    {...common}
                    component="select"
                    sx={controlSx(invalid)}
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        edit.set(path, e.target.value)
                    }
                >
                    {extra ? (
                        <option value={extra}>
                            {fmt(t.agentApproval.edit.asProposed, {
                                value: taskMetaLabel(extra, t.tasks.filters),
                            })}
                        </option>
                    ) : null}
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {taskMetaLabel(o, t.tasks.filters)}
                        </option>
                    ))}
                </Box>
            );
            break;
        }
        case "date":
        case "remindAt":
            control = (
                <Box
                    {...common}
                    component="input"
                    max={spec.kind === "date" ? "9999-12-31" : "9999-12-31T23:59"}
                    sx={controlSx(invalid)}
                    type={spec.kind === "date" ? "date" : "datetime-local"}
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        // Half a date reads as '' on a native input; on a field
                        // that may be cleared that would look like a clear.
                        edit.set(path, e.target.value, e.target.validity.badInput)
                    }
                />
            );
            break;
        case "tags":
            control = (
                <TagsEditor
                    describedBy={errorId}
                    id={controlId}
                    invalid={invalid}
                    value={Array.isArray(draft) ? draft : []}
                    onChange={(next) => edit.set(path, next)}
                />
            );
            // Whether each name exists is the server's to say, when the tool runs.
            hints.push(t.agentApproval.edit.tagsNote);
            break;
    }

    return (
        <Frame
            controlId={controlId}
            dirty={dirty}
            error={message}
            errorId={errorId}
            hints={hints}
            label={labelText}
            resetLabel={fmt(t.agentApproval.edit.resetField, { field: labelText })}
            wide={wide ?? (spec.kind === "text" || spec.kind === "body" || spec.kind === "tags")}
            onReset={() => edit.reset(path)}
        >
            {control}
        </Frame>
    );
};

/** The top-level editable fields of a call, in the server's order. */
export const EditFieldList = ({
    edit,
    args,
}: {
    edit: ApprovalEdit;
    args: Record<string, unknown>;
}) => {
    const idPrefix = useId();
    const flat = edit.fields.filter((f) => f.row === undefined);
    if (flat.length === 0) return null;
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
                columnGap: 1.25,
                rowGap: 0.75,
                mb: 0.75,
            }}
        >
            {flat.map((f) => (
                <FieldEditor key={f.path} args={args} edit={edit} field={f} idPrefix={idPrefix} />
            ))}
        </Box>
    );
};

/**
 * What `BulkUpdatePreview` puts in place of a row's diff line for a field the
 * person can edit (see its `editor` prop).
 */
export const BulkRowField = ({
    edit,
    args,
    idPrefix,
    row,
    name,
}: {
    edit: ApprovalEdit;
    args: Record<string, unknown>;
    idPrefix: string;
    row: number;
    name: string;
}) => {
    const field = edit.fields.find((f) => f.row === row && f.field === name);
    return field ? (
        <FieldEditor args={args} edit={edit} field={field} idPrefix={idPrefix} wide={false} />
    ) : null;
};
