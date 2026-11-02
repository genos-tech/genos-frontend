// Structured previews for the two sprint writes:
//
//   manage_sprint  one tool, an `action`: create a sprint (name, project,
//                  dates) or change one (only the fields being changed). There
//                  is no "end" action: ending a sprint early is setting its
//                  `end_date`, which the card shows as an End change.
//   delete_sprint  its own tool, because the MCP destructive opt-in is per
//                  tool; the sprint's milestones and their tasks are kept
//
// The backend labels `project_id` (project name) and `sprint_id` (sprint
// name). A label is printed only for what the caller may read, so either can
// still be a raw id. `start_date` / `end_date` are YYYY-MM-DD strings, shown
// as they arrive. Only the fields the model sent are listed, so an update
// reads as exactly what it changes. The event carries no snapshot of the
// present values, so an update shows the new value alone.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DirectionsRunRoundedIcon from "@mui/icons-material/DirectionsRunRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip, placeValue } from "./previewHelpers";

const DATE_FIELDS = ["start_date", "end_date"] as const;

export const ManageSprintPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const isUpdate = asString(args.action) === "update";
    const labels = t.agentApproval.sprintFieldLabels;

    const chips: string[] = [];
    const project = asString(args.project_id);
    if (!isUpdate && project) chips.push(`${t.agentApproval.project}: ${project}`);

    // A new sprint's name is the headline; an update lists it with the rest of
    // what changes, and only when the model sent one.
    const name = asString(args.name);
    if (isUpdate && args.name !== undefined && args.name !== null)
        chips.push(`${labels.name}: ${placeValue(args.name, t.agentApproval.cleared)}`);

    for (const field of DATE_FIELDS) {
        const proposed = args[field];
        if (proposed === undefined || proposed === null) continue;
        chips.push(`${labels[field]}: ${placeValue(proposed, t.agentApproval.cleared)}`);
    }

    const heading = isUpdate
        ? fmt(t.agentApproval.updateSprint, { sprint: asString(args.sprint_id) ?? "" })
        : t.agentApproval.newSprint;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {isUpdate ? (
                    <EditRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                ) : (
                    <DirectionsRunRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {!isUpdate && name ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
                    {name}
                </Typography>
            ) : null}
        </Box>
    );
};

export const DeleteSprintPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: palette.dangerTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.deleteSprint, { sprint: asString(args.sprint_id) ?? "" })}
                </Typography>
                <MetaChip label={t.agentApproval.cannotUndo} />
            </Box>
            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                {t.agentApproval.sprintMilestonesKept}
            </Typography>
        </Box>
    );
};
