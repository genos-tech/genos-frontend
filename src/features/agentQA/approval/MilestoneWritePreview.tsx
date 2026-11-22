// Structured previews for the two milestone writes (MIP-879):
//
//   manage_milestone  one tool, an `action`: create / update a milestone, or
//                     create / rename / delete a milestone folder; and, behind the
//                     genos-api flag AGENT_PARITY_TOOLS (MIP-1564), `convert` (a root
//                     task into a milestone with `task_id`, a milestone into a task
//                     with `milestone_id`) and an `update` that carries `project_id`
//                     (the milestone MOVES to another project)
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
//
// A convert adds `current.direction` (`task_to_milestone` | `milestone_to_task`) with
// the item's title and display id and what comes along or is dropped: the sub-tasks that
// join the new milestone (`sub_tasks`), or the tasks that stay under the row (`tasks`),
// the people (`assignee`, `collaborators`) and the `folder` and `sprint` that are dropped.
// A move adds `current.project_id` (the project it leaves) and `current.move`
// (`{tasks, sprint, folder, tags}`: how many tasks go with it and what is cleared). Nothing
// is said for an item the approver may not read; the card then shows what the model sent.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { MetaChip } from "./previewHelpers";
import { asString, diffValue } from "./previewValues";

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

type Action =
    | "create"
    | "update"
    | "create_folder"
    | "rename_folder"
    | "delete_folder"
    | "convert";

type ConvertCurrent = {
    direction?: "task_to_milestone" | "milestone_to_task";
    title?: string;
    display_id?: string | null;
    sub_tasks?: number;
    tasks?: number;
    assignee?: string | null;
    collaborators?: string[];
    folder?: string | number | null;
    sprint?: string | number | null;
};

type MoveCurrent = {
    tasks?: number;
    sprint?: string | number | null;
    folder?: string | number | null;
    tags?: string[];
};

const nonEmpty = (v: unknown): string | undefined => {
    const text = asString(v);
    return text === undefined || text === "" ? undefined : text;
};

export const ManageMilestonePreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const action = (asString(args.action) ?? "create") as Action;
    const currents = args.current as Record<string, unknown> | undefined;
    const convert = action === "convert" ? (currents as ConvertCurrent | undefined) : undefined;
    // A move is an update that carries the destination, with the facts the backend read.
    const move = action === "update" ? (currents?.move as MoveCurrent | undefined) : undefined;

    const chips: string[] = [];
    const project = asString(args.project_id);
    if (move) {
        const from = nonEmpty(currents?.project_id);
        chips.push(
            from && project
                ? fmt(t.agentApproval.moveProject, { from, to: project })
                : `${t.agentApproval.project}: ${project ?? ""}`
        );
    } else if (project) chips.push(`${t.agentApproval.project}: ${project}`);

    let heading: string;
    switch (action) {
        case "convert": {
            // The direction is what the model sent (`task_id` or `milestone_id`) when the backend
            // could not read the item for the approver.
            const toMilestone =
                convert?.direction !== undefined
                    ? convert.direction === "task_to_milestone"
                    : args.task_id !== undefined && args.task_id !== null && args.task_id !== "";
            const named = (title?: string, displayId?: string | null, fallback?: unknown) =>
                title ? [displayId, title].filter(Boolean).join(" ") : (asString(fallback) ?? "");
            heading = toMilestone
                ? fmt(t.agentApproval.milestoneAction.convert_to_milestone, {
                      task: named(convert?.title, convert?.display_id, args.task_id),
                  })
                : fmt(t.agentApproval.milestoneAction.convert_to_task, {
                      milestone: named(convert?.title, convert?.display_id, args.milestone_id),
                  });
            break;
        }
        case "update":
            heading = fmt(
                move
                    ? t.agentApproval.milestoneAction.move
                    : t.agentApproval.milestoneAction.update,
                { milestone: asString(args.milestone_id) ?? "" }
            );
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
    if (action === "convert") {
        chips.push(t.agentApproval.convertKeeps);
        if (convert?.direction === "task_to_milestone") {
            const count = Number(convert.sub_tasks ?? 0);
            if (count > 0) chips.push(fmt(t.agentApproval.convertSubTasksJoin, { count }));
        } else if (convert?.direction === "milestone_to_task") {
            const count = Number(convert.tasks ?? 0);
            if (count > 0) chips.push(fmt(t.agentApproval.convertTasksStay, { count }));
            const assignee = nonEmpty(convert.assignee);
            if (assignee) chips.push(fmt(t.agentApproval.convertAssignee, { name: assignee }));
            const others = (convert.collaborators ?? []).map(String).filter(Boolean);
            if (others.length)
                chips.push(
                    fmt(t.agentApproval.convertCollaborators, { names: others.join(", ") })
                );
            const folder = nonEmpty(convert.folder);
            if (folder) chips.push(fmt(t.agentApproval.convertFolderDropped, { name: folder }));
            const sprint = nonEmpty(convert.sprint);
            if (sprint) chips.push(fmt(t.agentApproval.convertSprintDropped, { name: sprint }));
        }
    } else if (isFolderAction) {
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
        if (move) {
            const count = Number(move.tasks ?? 0);
            if (count > 0) chips.push(fmt(t.agentApproval.moveTasks, { count }));
            const sprint = nonEmpty(move.sprint);
            if (sprint) chips.push(fmt(t.agentApproval.moveSprintCleared, { name: sprint }));
            const folder = nonEmpty(move.folder);
            if (folder) chips.push(fmt(t.agentApproval.moveFolderCleared, { name: folder }));
            const tags = (move.tags ?? []).map(String).filter(Boolean);
            if (tags.length)
                chips.push(fmt(t.agentApproval.moveTagsCleared, { names: tags.join(", ") }));
            chips.push(t.agentApproval.moveRenumbered);
        }
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
                {action === "convert" ? (
                    <SwapHorizRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                ) : move ? (
                    <DriveFileMoveRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                ) : action === "update" || action === "rename_folder" ? (
                    <EditRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                ) : action === "delete_folder" ? (
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                ) : (
                    <FlagRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {heading}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {title ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                    {titleWas && titleWas !== title ? (
                        <>
                            <Box
                                component="span"
                                sx={{ textDecoration: "line-through", color: g.text.secondary }}
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
                        borderColor: g.border.subtle,
                        fontSize: "0.8125rem",
                        color: g.text.secondary,
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

export const DeleteMilestonePreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const current = args.current as { title?: string; tasks?: number } | undefined;

    const chips: string[] = [];
    const tasks = Number(current?.tasks ?? 0);
    if (tasks > 0) chips.push(fmt(t.agentApproval.milestoneTasksKept, { count: tasks }));

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
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
