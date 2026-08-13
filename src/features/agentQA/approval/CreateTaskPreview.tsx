// Structured preview for a `create_task` proposal: a "New task" header
// with the destination project + priority / effort / due-date chips, the
// proposed title, and the plain-text body. Renders purely from the
// (friendly-ized) proposal arguments — project_id arrives as the project
// name; nothing exists in the DB yet at approval time. content_text is
// plain text (the tool takes no markdown), so it is shown verbatim rather
// than parsed.

import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import { Box, Chip, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

export const CreateTaskPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const title = asString(args.title);
    const body = asString(args.content_text);
    const projectLabel = asString(args.project_id);
    const priority = asString(args.priority);
    const effort = asString(args.effort_level);
    const dueDate = asString(args.due_date);

    const chips: string[] = [];
    if (projectLabel) chips.push(`${t.agentApproval.project}: ${projectLabel}`);
    if (priority) chips.push(priority);
    if (effort) chips.push(effort);
    if (dueDate) chips.push(`${t.agentApproval.due} ${dueDate}`);

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
