// Structured previews for the two milestone writes (MIP-879):
//
//   manage_milestone  one tool, an `action`: create / update a milestone, or
//                     create / rename / delete a milestone folder
//   delete_milestone  its own tool, because the MCP destructive opt-in is
//                     per tool; the tasks are kept
//
// The backend labels `project_id` (project name), `milestone_id` (title),
// `milestone_folder_id` (folder name) and `sprint_id` (sprint name), and
// turns `assignee_ids` into usernames. A label is printed only for what the
// caller may read, so any of them can still be a raw id. For an update it
// adds `current.<field>` for every field being changed (null = unset), so the
// card can read "old → new"; for a folder rename or delete, the folder's
// present name (and how many milestones a delete unfiles); for a delete, the
// milestone's title and how many tasks it detaches.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, diffValue, MetaChip } from "./previewHelpers";

// `''` clears a folder, a sprint and a date; `[]` clears tags and assignees.
const FIELDS = [
    "status",
    "priority",
    "effort_level",
    "start_date",
    "due_date",
    "tags",
    "assignee_ids",
    "milestone_folder_id",
    "sprint_id",
] as const;

type Action = "create" | "update" | "create_folder" | "rename_folder" | "delete_folder";

export const ManageMilestonePreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const action = (asString(args.action) ?? "create") as Action;
    const currents = args.current as Record<string, unknown> | undefined;

    const chips: string[] = [];
    const project = asString(args.project_id);
    if (project) chips.push(`${t.agentApproval.project}: ${project}`);

    let heading: string;
    switch (action) {
        case "update":
            heading = fmt(t.agentApproval.milestoneAction.update, {
                milestone: asString(args.milestone_id) ?? "",
            });
            break;
        case "create_folder":
            heading = t.agentApproval.milestoneAction.create_folder;
            break;
        case "rename_folder":
            heading = t.agentApproval.milestoneAction.rename_folder;
            break;
        case "delete_folder":
            heading = t.agentApproval.milestoneAction.delete_folder;
            break;
        default:
            heading = t.agentApproval.milestoneAction.create;
    }

    const isFolderAction = action.endsWith("_folder");
    if (isFolderAction) {
        const name = asString(args.folder_name);
        const was = asString(currents?.folder_name);
        if (action === "rename_folder" && name)
            chips.push(`${t.agentApproval.folder}: ${was ? `${was} → ` : ""}${name}`);
        else if (action === "create_folder" && name)
            chips.push(`${t.agentApproval.folder}: ${name}`);
        else if (action === "delete_folder") {
            const target = was ?? asString(args.milestone_folder_id);
            if (target) chips.push(`${t.agentApproval.folder}: ${target}`);
            const count = Number(currents?.milestones ?? 0);
            if (count > 0) chips.push(fmt(t.agentApproval.folderUnfiles, { count }));
        }
    } else {
        for (const field of FIELDS) {
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
    }

    const title = asString(args.title);
    const titleWas = asString(currents?.title);
    const body = asString(args.description_markdown);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {action === "update" || action === "rename_folder" ? (
                    <EditRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                ) : action === "delete_folder" ? (
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: palette.dangerTint }} />
                ) : (
                    <FlagRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
                    {titleWas && titleWas !== title ? (
                        <>
                            <Box
                                component="span"
                                sx={{ textDecoration: "line-through", color: palette.textMuted }}
                            >
                                {titleWas}
                            </Box>
                            {" → "}
                        </>
                    ) : null}
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

export const DeleteMilestonePreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const current = args.current as { title?: string; tasks?: number } | undefined;

    const chips: string[] = [];
    const tasks = Number(current?.tasks ?? 0);
    if (tasks > 0) chips.push(fmt(t.agentApproval.milestoneTasksKept, { count: tasks }));

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: palette.dangerTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.deleteMilestone, {
                        milestone: current?.title ?? asString(args.milestone_id) ?? "",
                    })}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>
        </Box>
    );
};
