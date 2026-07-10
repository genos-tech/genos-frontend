// Structured preview for `create_note` / `update_note` proposals: one
// header line saying what happens to which note (destination chips for
// creates, changed-field chips for updates) above the proposed body
// rendered as markdown — the body IS the proposal, so it's shown in
// full inside a scroll box rather than behind a toggle. Renders purely
// from the (friendly-ized) proposal arguments: project_id arrives as
// the project name, task_id as the task's display id, folder_id as the
// folder name, and updates carry a server-resolved `note_title`.

import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Chip, Typography } from "@mui/joy";
import ReactMarkdown from "react-markdown";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

export const NoteWritePreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    // `note_id` only exists on update_note proposals (create_note's
    // result has one, but its ARGS never do) — that's the mode switch.
    const isUpdate = args.note_id !== undefined && args.note_id !== null;
    const noteType = asString(args.note_type);
    const title = asString(args.title);
    const body = asString(args.content_text);
    const projectLabel = asString(args.project_id);
    const taskLabel = asString(args.task_id);
    const folderLabel = asString(args.folder_id);

    const header = isUpdate
        ? fmt(t.agentApproval.updateNote, {
              note: asString(args.note_title) || `#${asString(args.note_id)}`,
          })
        : noteType === "task"
          ? t.agentApproval.newTaskNote
          : t.agentApproval.newPersonalNote;

    // Creates show WHERE the note lands; updates show WHAT changes.
    const chips: string[] = [];
    if (isUpdate) {
        if (title) chips.push(t.agentApproval.changesTitle);
        if (args.content_text !== undefined && args.content_text !== null) {
            chips.push(t.agentApproval.changesBody);
        }
        if ("folder_id" in args) chips.push(t.agentApproval.changesFolder);
    } else {
        if (projectLabel) chips.push(`${t.agentApproval.project}: ${projectLabel}`);
        if (taskLabel) chips.push(`${t.agentApproval.task}: ${taskLabel}`);
        if (folderLabel) chips.push(`${t.agentApproval.folder}: ${folderLabel}`);
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <StickyNote2RoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {header}
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
                        "& p": { m: 0 },
                        "& ul, & ol": { m: 0, pl: 2.5 },
                        "& h1, & h2, & h3": {
                            m: 0,
                            mt: 0.5,
                            fontSize: "0.875rem",
                            color: palette.text,
                        },
                    }}
                >
                    <ReactMarkdown>{body}</ReactMarkdown>
                </Box>
            ) : null}
        </Box>
    );
};
