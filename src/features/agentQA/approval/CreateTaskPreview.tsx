// Structured preview for a `create_task` proposal: a "New task" header
// with the destination project + priority / effort / due-date chips, the
// proposed title, and the plain-text body. Renders purely from the
// (friendly-ized) proposal arguments — project_id arrives as the project
// name; nothing exists in the DB yet at approval time. content_text is
// plain text (the tool takes no markdown), so it is shown verbatim rather
// than parsed.

import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { MetaChip, placeValue } from "./previewHelpers";

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const CreateTaskPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const title = asString(args.title);
    const body = asString(args.content_text);
    const projectLabel = asString(args.project_id);
    // Arrives friendly-ized to the parent's display id.
    const parentLabel = asString(args.parent_task_id);
    const startDate = asString(args.start_date);
    // Usernames, or the raw id for someone the caller can't name.
    const collaborators = Array.isArray(args.collaborators) ? args.collaborators.map(String) : [];
    const customFields = (Array.isArray(args.custom_fields) ? args.custom_fields : []) as {
        name?: string;
        value?: unknown;
        values?: unknown;
    }[];
    const priority = asString(args.priority);
    const effort = asString(args.effort_level);
    const dueDate = asString(args.due_date);

    const chips: string[] = [];
    if (projectLabel) chips.push(`${t.agentApproval.project}: ${projectLabel}`);
    if (parentLabel) chips.push(`${t.agentApproval.fieldLabels.parent_task_id}: ${parentLabel}`);
    if (priority) chips.push(priority);
    if (effort) chips.push(effort);
    if (dueDate) chips.push(`${t.agentApproval.due} ${dueDate}`);
    if (startDate) chips.push(`${t.agentApproval.start} ${startDate}`);
    if (collaborators.length)
        chips.push(`${t.agentApproval.fieldLabels.collaborators}: ${collaborators.join(", ")}`);
    for (const entry of customFields) {
        const name = asString(entry.name);
        const shown = placeValue(
            entry.values !== undefined ? entry.values : entry.value,
            t.agentApproval.cleared
        );
        if (name) chips.push(`${name}: ${shown}`);
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <AddTaskRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {t.agentApproval.newTask}
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
                        // Plain text (not markdown) — preserve the author's
                        // line breaks without letting a long line overflow.
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
