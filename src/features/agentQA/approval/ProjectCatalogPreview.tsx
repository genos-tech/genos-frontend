// Structured previews for the two writes that add to a project's catalog:
//
//   add_project_tag         a tag on the project's own tag list (the tags its
//                           TASKS carry). Drawn as the app draws a tag.
//   manage_project_labels   one tool, an `action`: create a label, or put
//                           labels on a project or take them off. A label
//                           belongs to the whole team and is shown on PROJECTS
//                           (the chips in the project list), so a new one is
//                           drawn as the project list draws it.
//
// The backend labels `project_id` (project name) and `label_ids` (a list of
// label names). A label is printed only for what the caller may read, so a
// project can still be a raw id and the label list can mix names and ids: the
// card prints whatever arrived and never looks anything up.
//
// `color` is the model's own text, not validated by the card. A `#rrggbb`
// value is drawn as is. A missing one is the tool's default (grey for a tag,
// purple for a label, the same defaults the API applies). Anything else is
// drawn in the default and named under the chip, because the API refuses it
// once approved, and `alpha()` in the tag chip throws on a value like "blue".

import LabelRoundedIcon from "@mui/icons-material/LabelRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import NewLabelRoundedIcon from "@mui/icons-material/NewLabelRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { ProjectLabelChips } from "../../admin/components/projectLabels/ProjectLabelChips";
import { ProjectTagChip } from "../../tasks/components/ProjectTagChip";
import { getContrastTextColor } from "../../tasks/utils/contrastTextColor";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

// What the API applies when the model sends no color (`DEFAULT_TAG_COLOR`,
// `DEFAULT_LABEL_COLOR` in genos-api `services/project_catalog.py`).
const DEFAULT_TAG_COLOR = "#808080";
const DEFAULT_LABEL_COLOR = "#7c3aed";

// The API's own test: a trimmed `#rrggbb`.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** The color to draw in, and the model's text when it is not one the API takes. */
const resolveColor = (raw: unknown, fallback: string): { color: string; rejected?: string } => {
    if (raw === undefined || raw === null || raw === "") return { color: fallback };
    const text = typeof raw === "string" ? raw.trim() : "";
    if (HEX_COLOR.test(text)) return { color: text.toLowerCase() };
    return { color: fallback, rejected: typeof raw === "string" ? raw : JSON.stringify(raw) };
};

export const AddProjectTagPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const name = asString(args.tag_name);
    const project = asString(args.project_id);
    const { color, rejected } = resolveColor(args.color, DEFAULT_TAG_COLOR);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <LocalOfferRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {t.agentApproval.addProjectTag}
                </Typography>
                {name ? <ProjectTagChip isDark={isDark} label={name} tagColor={color} /> : null}
                {project ? (
                    <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                        {fmt(t.agentApproval.projectTagOn, { project })}
                    </Typography>
                ) : null}
            </Box>
            {rejected !== undefined ? (
                <Typography level="body-xs" sx={{ color: palette.dangerTint }}>
                    {fmt(t.agentApproval.projectColorInvalid, { color: rejected })}
                </Typography>
            ) : null}
        </Box>
    );
};

export const ManageProjectLabelsPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const action = asString(args.action);
    const project = asString(args.project_id) ?? t.agentApproval.thisProject;

    if (action === "create") {
        const name = asString(args.name);
        const { color, rejected } = resolveColor(args.color, DEFAULT_LABEL_COLOR);
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                    <NewLabelRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                    <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                        {t.agentApproval.newProjectLabel}
                    </Typography>
                    {name ? (
                        <ProjectLabelChips
                            size="md"
                            labels={[
                                {
                                    labelId: 0,
                                    name,
                                    color,
                                    textColor: getContrastTextColor(color),
                                },
                            ]}
                        />
                    ) : null}
                </Box>
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {t.agentApproval.projectLabelTeamWide}
                </Typography>
                {rejected !== undefined ? (
                    <Typography level="body-xs" sx={{ color: palette.dangerTint }}>
                        {fmt(t.agentApproval.projectColorInvalid, { color: rejected })}
                    </Typography>
                ) : null}
            </Box>
        );
    }

    // assign / unassign, and any other `action` falls to a neutral heading.
    const names = Array.isArray(args.label_ids) ? args.label_ids.map(String) : [];
    let heading: string;
    if (action === "assign") heading = fmt(t.agentApproval.putLabelsOnProject, { project });
    else if (action === "unassign")
        heading = fmt(t.agentApproval.takeLabelsOffProject, { project });
    else heading = fmt(t.agentApproval.changeProjectLabels, { project });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <LabelRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
            </Box>
            {names.length > 0 ? (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {names.map((n, i) => (
                        <MetaChip key={`${n}-${i}`} label={n} />
                    ))}
                </Box>
            ) : null}
        </Box>
    );
};
