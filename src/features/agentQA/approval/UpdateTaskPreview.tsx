// Structured preview for an `update_task` proposal: an "Update task: WRD-5"
// header (task_id arrives friendly-ized to the task's display id) followed
// by the proposed changes — the new title, chips for the changed
// status / priority / effort / due-date fields, and the new plain-text
// body. Only the fields the model actually proposes appear (the tool omits
// the rest), so the card shows exactly what will change.
//
// Unlike `update_tasks_bulk`, the pending event carries no `current`
// snapshot for a single update, so this shows the proposed value only
// (no old → new diff) — except for a move (milestone, parent, project) and
// for the start date, collaborators and custom fields, where the backend adds
// `current.<field>` (the present milestone title, parent display id, project
// name, ISO date, usernames; null = none) so the chip reads
// "Milestone: old → new". Custom fields are a list of `{name, value | values}`
// and their present values arrive in `current.custom_fields`, keyed by that
// same name. `due_date: ''` / `content_text: ''` / `milestone_id: ''` /
// `parent_task_id: ''` / `start_date: ''` / `collaborators: []` are the tool's
// "clear this field" sentinels and render as a clear rather than a blank.

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { diffValue, MetaChip, placeValue } from "./previewHelpers";

const CHIP_FIELDS = ["status", "priority", "effort_level", "due_date"] as const;
type ChipField = (typeof CHIP_FIELDS)[number];

// Fields that PLACE the task. null is the tool's "no move", not a detach;
// only '' clears.
const MOVE_FIELDS = [
    "milestone_id",
    "parent_task_id",
    "project_id",
    "start_date",
    "collaborators",
] as const;

interface CustomFieldEntry {
    name?: string;
    value?: unknown;
    values?: unknown;
}

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const UpdateTaskPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();

    const taskLabel = asString(args.task_id);
    const title = asString(args.title);
    // Distinguish "not proposed" (undefined → omit) from "clear the body"
    // (empty string → show as a cleared chip); a present non-empty body
    // renders in full below.
    const bodyProposed = args.content_text !== undefined;
    const body = asString(args.content_text);

    const chips: string[] = [];
    for (const field of CHIP_FIELDS) {
        const value = args[field as ChipField];
        if (value === undefined) continue;
        const shown = value === "" || value === null ? t.agentApproval.cleared : String(value);
        chips.push(`${t.agentApproval.fieldLabels[field]}: ${shown}`);
    }
    const currents = args.current as Record<string, unknown> | undefined;
    for (const field of MOVE_FIELDS) {
        const proposed = args[field];
        if (proposed === undefined || proposed === null) continue;
        chips.push(
            `${t.agentApproval.fieldLabels[field]}: ${diffValue(
                proposed,
                currents?.[field],
                t.agentApproval.cleared
            )}`
        );
    }
    // Custom fields are matched to their present value by the name the call used.
    const presentCustom = currents?.custom_fields as Record<string, unknown> | undefined;
    const customEntries = Array.isArray(args.custom_fields)
        ? (args.custom_fields as CustomFieldEntry[])
        : [];
    for (const entry of customEntries) {
        const name = asString(entry.name);
        if (!name) continue;
        const proposed = entry.values !== undefined ? entry.values : entry.value;
        chips.push(
            `${name}: ${diffValue(proposed, presentCustom?.[name], t.agentApproval.cleared)}`
        );
    }
    if (bodyProposed && !body)
        chips.push(`${t.agentApproval.changesBody}: ${t.agentApproval.cleared}`);
    // The tags REPLACE the task's tags; [] clears them. (They were never shown
    // here before: the person was approving a change the card did not name.)
    if (Array.isArray(args.tags)) {
        chips.push(
            `${t.agentApproval.fieldLabels.tags}: ${placeValue(args.tags, t.agentApproval.cleared)}`
        );
    }
    // A passage added to the description, the other way to change a body.
    const added: Array<{ label: string; text: string }> = [];
    const prepend = asString(args.body_prepend);
    const append = asString(args.body_append);
    if (prepend) added.push({ label: t.agentApproval.edit.fields.addToStart, text: prepend });
    if (append) added.push({ label: t.agentApproval.edit.fields.addToEnd, text: append });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <EditRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.updateTask, { task: taskLabel ?? "" })}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                    {title}
                </Typography>
            ) : null}

            {body ? (
                <Box
                    sx={{
                        maxHeight: 260,
                        overflowY: "auto",
                        pl: 1.25,
                        borderLeft: "2px solid",
                        borderColor: g.border.subtle,
                        fontSize: "0.8125rem",
                        color: g.text.secondary,
                        // Plain text (not markdown) — preserve line breaks.
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {body}
                </Box>
            ) : null}

            {added.map(({ label, text }) => (
                <Box key={label} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                    <Typography level="body-xs" sx={{ color: g.text.secondary, fontWeight: 700 }}>
                        {label}
                    </Typography>
                    <Box
                        sx={{
                            maxHeight: 260,
                            overflowY: "auto",
                            pl: 1.25,
                            borderLeft: "2px solid",
                            borderColor: g.border.subtle,
                            fontSize: "0.8125rem",
                            color: g.text.secondary,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {text}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};
