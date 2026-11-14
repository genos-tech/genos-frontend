// Structured preview for a `create_task` proposal: a "New task" header
// with the destination project + priority / effort / due-date chips, the
// proposed title, and the plain-text body. Renders purely from the
// (friendly-ized) proposal arguments — project_id arrives as the project
// name; nothing exists in the DB yet at approval time. content_text is
// plain text (the tool takes no markdown), so it is shown verbatim rather
// than parsed.
//
// MIP-1561 (AGENT_PARITY_TOOLS): a call may also carry the starting `status`, a
// `reporter_id` (arrives as a username), a `template` name and `links`. Each is
// shown, so the person is never approving a field the card does not name. Links
// are drawn as TEXT (title and URL), never as anchors: the card shows them before
// the server has judged the scheme.

import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { linkEntries, LinkLines, MetaChip, placeValue } from "./previewHelpers";

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const CreateTaskPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();

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
    const status = asString(args.status);
    const reporter = asString(args.reporter_id);
    const template = asString(args.template);
    const links = linkEntries(args.links);

    const chips: string[] = [];
    if (projectLabel) chips.push(`${t.agentApproval.project}: ${projectLabel}`);
    if (parentLabel) chips.push(`${t.agentApproval.fieldLabels.parent_task_id}: ${parentLabel}`);
    if (status) chips.push(`${t.agentApproval.fieldLabels.status}: ${status}`);
    if (priority) chips.push(priority);
    if (effort) chips.push(effort);
    if (dueDate) chips.push(`${t.agentApproval.due} ${dueDate}`);
    if (startDate) chips.push(`${t.agentApproval.start} ${startDate}`);
    if (reporter) chips.push(`${t.agentApproval.fieldLabels.reporter_id}: ${reporter}`);
    if (template) chips.push(`${t.agentApproval.fieldLabels.template}: ${template}`);
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
                <AddTaskRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {t.agentApproval.newTask}
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

            {links.length ? (
                <LinkLines links={links} label={t.agentApproval.fieldLabels.links} />
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
