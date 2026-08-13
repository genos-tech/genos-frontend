// Structured preview for an `update_task` proposal: an "Update task: WRD-5"
// header (task_id arrives friendly-ized to the task's display id) followed
// by the proposed changes — the new title, chips for the changed
// status / priority / effort / due-date fields, and the new plain-text
// body. Only the fields the model actually proposes appear (the tool omits
// the rest), so the card shows exactly what will change.
//
// Unlike `update_tasks_bulk`, the pending event carries no `current`
// snapshot for a single update, so this shows the proposed value only
// (no old → new diff). `due_date: ''` / `content_text: ''` are the tool's
// "clear this field" sentinels and render as a clear rather than a blank.

import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Chip, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";

const CHIP_FIELDS = ["status", "priority", "effort_level", "due_date"] as const;
type ChipField = (typeof CHIP_FIELDS)[number];

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

export const UpdateTaskPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

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
    if (bodyProposed && !body)
        chips.push(`${t.agentApproval.changesBody}: ${t.agentApproval.cleared}`);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <EditRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.updateTask, { task: taskLabel ?? "" })}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
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
                        borderColor: palette.borderMuted,
                        fontSize: "0.8125rem",
                        color: palette.textMuted,
                        // Plain text (not markdown) — preserve line breaks.
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {body}
                </Box>
            ) : null}
        </Box>
    );
};
