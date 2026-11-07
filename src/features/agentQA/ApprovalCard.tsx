// Write-tool approval card.
//
// Rendered when the agent loop pauses on a `requires_approval=True`
// tool (currently `create_task`, `update_task`, `add_comment`,
// `create_note`, calendar writes, etc.). Shows the tool name + the
// arguments the model proposed; Approve/Reject buttons resume the
// stream via POST /api/v2/agent/decide/.
//
// Composite tools (create_task_plan, update_tasks_bulk) get a
// structured preview from `approval/approvalRenderers`; every other
// tool keeps the key:value fallback below.
//
// EDIT BEFORE APPROVE. When the pending event lists `editable` paths (the
// backend's allow-list, genos-api #570) the card offers an Edit button. Edit
// mode turns those values into inputs (`approval/ApprovalEditFields`), shows
// what Genos proposed beside what was changed, and Approve then sends ONLY
// the fields that changed: `onApprove({path: value})`. Nothing changed (or
// never opened) is a plain `onApprove()`. Reject never carries edits. A tool
// with nothing editable gets no button and renders exactly as before.
//
// `onApprove` is called EXPLICITLY, never wired as `onClick={onApprove}`: it
// takes the edit payload now, and a click handler would hand it the click event.
//
// A refused attempt (the server's 422) comes back as `fieldErrors` and the
// `restoredEdits` the person had typed: the card opens in edit mode on them,
// with each sentence beside its field.
//
// CAN'T BE UNDONE. When the pending event says `undoable === false`, a small chip
// (`approval/UndoChip`) tells the person BEFORE they approve, with the reason. Only
// `false` is a claim; absent (older backend) or `true` shows nothing.
//
// The existing labels (heading, Approve, Reject) are props, so every agent
// surface (Spotlight, threadAsk, noteAsk) mounts the same component with
// surface-specific i18n copy. The edit chrome and the structured preview
// renderers consume the `agentApproval` i18n namespace directly (see the note
// in `locales/en/agentApproval.ts`).

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Button, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../i18n";
import type { PendingApprovalPayload } from "../../services/agentApi";
import { g } from "../../theme/tokens";
import { BulkRowField, EditFieldList } from "./approval/ApprovalEditFields";
import { getApprovalRenderer } from "./approval/approvalRenderers";
import { BulkUpdatePreview } from "./approval/BulkUpdatePreview";
import { withoutEditable } from "./approval/editableFields";
import { UndoChip } from "./approval/UndoChip";
import { useApprovalEdit } from "./approval/useApprovalEdit";

interface ApprovalCardProps {
    pending: PendingApprovalPayload;
    // `editedArgs` carries ONLY the fields the person changed, `{path: value}`;
    // absent = approve as proposed.
    onApprove: (editedArgs?: Record<string, unknown>) => void;
    onReject: () => void;
    // Pre-formatted "Approval required: <tool>" heading. The caller
    // does the i18n interpolation so this module stays string-free.
    titleText: string;
    approveLabel: string;
    rejectLabel: string;
    // After a refused attempt: the server's sentence per path, and the patch it
    // refused (so the editors reopen on what was typed).
    fieldErrors?: Record<string, string> | null;
    restoredEdits?: Record<string, unknown> | null;
}

export const ApprovalCard = ({
    pending,
    onApprove,
    onReject,
    titleText,
    approveLabel,
    rejectLabel,
    fieldErrors,
    restoredEdits,
}: ApprovalCardProps) => {
    const { t } = useTranslation();
    const args = pending.arguments || {};
    const argEntries = Object.entries(args);
    const PreviewRenderer = getApprovalRenderer(pending.tool_name);
    const edit = useApprovalEdit({
        tool: pending.tool_name,
        args,
        editable: pending.editable,
        fieldErrors,
        restoredEdits,
    });
    const idPrefix = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const wasEditing = useRef(false);

    const canEdit = edit.fields.length > 0;
    const editing = canEdit && edit.editing;
    const isBulk = pending.tool_name === "update_tasks_bulk";
    // In edit mode the editable values are inputs, so the preview keeps what
    // the person is not changing and nothing is said twice.
    const shownArgs = editing ? withoutEditable(args, edit.fields) : args;

    // Focus: into the first problem (a refused attempt) or the first field when
    // edit mode opens; back to the Edit button when it closes.
    useEffect(() => {
        if (editing && !wasEditing.current) {
            const root = rootRef.current;
            const target =
                root?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
                root?.querySelector<HTMLElement>("[data-approval-field]");
            target?.focus();
        } else if (!editing && wasEditing.current) {
            editButtonRef.current?.focus();
        }
        wasEditing.current = editing;
    }, [editing]);

    // Keys inside the card never reach the host. Escape only cancels the edit
    // (Spotlight's document-level Escape handler would close the whole overlay,
    // a Joy modal its dialog), and Enter in a field must not approve or send.
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (!editing) return;
        // An IME confirming a conversion (Japanese, Chinese, Korean) sends
        // Enter and Escape of its own: they belong to the composition.
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            edit.cancel();
            return;
        }
        if (e.key === "Enter") {
            if (e.target instanceof HTMLInputElement) e.preventDefault();
            e.stopPropagation();
        }
    };

    // Exactly `onApprove()` when nothing changed: a plain approve carries no
    // argument at all, not an `undefined` one.
    const approve = () => {
        if (edit.changeCount > 0) onApprove(edit.patch);
        else onApprove();
    };

    const preview =
        isBulk && editing ? (
            <BulkUpdatePreview
                args={shownArgs}
                editor={{
                    has: (row, field) =>
                        edit.fields.some((f) => f.row === row && f.field === field),
                    render: (row, field) => (
                        <BulkRowField
                            args={args}
                            edit={edit}
                            idPrefix={idPrefix}
                            name={field}
                            row={row}
                        />
                    ),
                }}
            />
        ) : PreviewRenderer ? (
            // A backend that predicts undo says it once, in the chip below: the
            // previews that used to say "cannot be undone" themselves stop.
            <PreviewRenderer args={shownArgs} undoKnown={pending.undoable !== undefined} />
        ) : (
            argEntries.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.15,
                        mb: 0.75,
                        fontSize: "0.9375rem",
                        fontFamily: "monospace",
                        opacity: 0.9,
                    }}
                >
                    {Object.entries(shownArgs).map(([k, v]) => (
                        <Box key={k} sx={{ display: "flex", gap: 0.5 }}>
                            <Box component="span" sx={{ opacity: 0.8 }}>
                                {k}:
                            </Box>
                            <Box component="span" sx={{ flex: 1, wordBreak: "break-word" }}>
                                {typeof v === "string" ? v : JSON.stringify(v)}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )
        );

    return (
        <Box
            ref={rootRef}
            sx={{
                mt: 0.75,
                mb: 0.75,
                px: 1.25,
                py: 1,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: g.warning.border,
                background: g.warning.subtle,
            }}
            onKeyDown={onKeyDown}
        >
            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: g.warning.text,
                    mb: 0.5,
                }}
            >
                {titleText}
            </Typography>

            {editing && edit.refused ? (
                // A role=alert that arrives with the card is announced when it
                // mounts (the card remounts on a refused attempt).
                <Box
                    role="alert"
                    sx={{
                        mb: 0.75,
                        px: 1,
                        py: 0.5,
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: g.danger.border,
                        background: g.danger.subtle,
                        color: g.danger.text,
                        fontSize: "0.8125rem",
                    }}
                >
                    <Typography level="body-sm" sx={{ color: "inherit", fontWeight: 600 }}>
                        {t.agentApproval.edit.rejected}
                    </Typography>
                    {edit.unplaced.map(([path, message]) => (
                        <Typography key={path} level="body-xs" sx={{ color: "inherit" }}>
                            {path}: {message}
                        </Typography>
                    ))}
                </Box>
            ) : null}

            {editing ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary, mb: 0.5 }}>
                    {t.agentApproval.edit.hint}
                </Typography>
            ) : null}

            {preview}

            {editing && !isBulk ? (
                <Box aria-label={t.agentApproval.edit.groupLabel} role="group">
                    <EditFieldList args={args} edit={edit} />
                </Box>
            ) : null}

            <UndoChip pending={pending} />

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                <Button
                    color="success"
                    disabled={editing && edit.blocked}
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="solid"
                    onClick={approve}
                >
                    {editing && edit.changeCount > 0
                        ? t.agentApproval.edit.approveWithChanges
                        : approveLabel}
                </Button>
                {canEdit && !editing ? (
                    <Button
                        ref={editButtonRef}
                        color="neutral"
                        size="sm"
                        startDecorator={<EditRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={{ fontSize: "0.9375rem" }}
                        variant="outlined"
                        onClick={edit.start}
                    >
                        {t.agentApproval.edit.edit}
                    </Button>
                ) : null}
                {editing ? (
                    <Button
                        color="neutral"
                        size="sm"
                        sx={{ fontSize: "0.9375rem" }}
                        variant="plain"
                        onClick={edit.cancel}
                    >
                        {t.agentApproval.edit.cancelEdit}
                    </Button>
                ) : null}
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="outlined"
                    onClick={() => onReject()}
                >
                    {rejectLabel}
                </Button>
                {editing ? (
                    <Typography
                        aria-live="polite"
                        level="body-xs"
                        sx={{ color: g.text.secondary, ml: 0.25 }}
                    >
                        {edit.changeCount > 0
                            ? fmt(t.agentApproval.edit.changesCount, { count: edit.changeCount })
                            : ""}
                    </Typography>
                ) : null}
            </Box>
        </Box>
    );
};
