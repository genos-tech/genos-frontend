// Structured preview for a `create_task_plan` proposal: milestone
// header, the task tree (sub-tasks indented under their parent), per
// task chips for priority / effort / dates / assignee, "blocked by"
// sublines resolved to the referenced tasks' titles, and collapsible
// markdown bodies. Renders purely from the (friendly-ized) proposal
// arguments — nothing exists in the DB yet at approval time.

import { useState } from "react";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Typography } from "@mui/joy";
import ReactMarkdown from "react-markdown";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { MilestoneFlag } from "../../tasks/components/card/parts";
import { EffortLabel } from "../../tasks/components/meta/EffortLabel";
import { PriorityIcon } from "../../tasks/components/meta/PriorityIcon";
import { isPriorityName } from "../../tasks/meta/taskTone";
import { agentMarkdownComponents } from "../agentMarkdown";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { MetaChip } from "./previewHelpers";

interface PlanTaskArg {
    title?: string;
    content_markdown?: string;
    // MIP-1561 (AGENT_PARITY_TOOLS): the starting status and a body template name.
    status?: string;
    template?: string;
    priority?: string;
    effort_level?: string;
    start_date?: string;
    due_date?: string;
    assignee_id?: string;
    parent_index?: number;
    blocked_by_indexes?: number[];
}

interface PlanMilestoneArg {
    title?: string;
    description_markdown?: string;
    priority?: string;
    effort_level?: string;
    start_date?: string;
    due_date?: string;
    assignee_ids?: string[];
}

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

// A priority as the task family draws it (the shared icon with its name). A value
// that is not one of the product's priorities (the model can send anything)
// stays a text chip, so it is never silently dropped.
const PlanPriority = ({ value }: { value: string }) =>
    isPriorityName(value) ? (
        <PriorityIcon priority={value} showLabel />
    ) : (
        <MetaChip label={value} />
    );

const TaskRow = ({
    task,
    allTasks,
    isSubtask,
}: {
    task: PlanTaskArg;
    allTasks: PlanTaskArg[];
    isSubtask: boolean;
}) => {
    const { t } = useTranslation();
    const [showBody, setShowBody] = useState(false);

    const blockedBy = (task.blocked_by_indexes || [])
        .map((i) => allTasks[i]?.title)
        .filter(Boolean) as string[];

    const chips: string[] = [];
    if (task.status) chips.push(`${t.agentApproval.fieldLabels.status}: ${task.status}`);
    if (task.template) chips.push(`${t.agentApproval.fieldLabels.template}: ${task.template}`);
    if (task.due_date) chips.push(`${t.agentApproval.due} ${task.due_date}`);
    if (task.assignee_id) chips.push(String(task.assignee_id));

    return (
        <Box sx={{ ml: isSubtask ? 2.25 : 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <Typography level="body-sm" sx={{ fontWeight: 500, color: g.text.primary }}>
                    {isSubtask ? "↳ " : ""}
                    {task.title || "—"}
                </Typography>
                {task.priority ? <PlanPriority value={task.priority} /> : null}
                {task.effort_level ? <EffortLabel level={task.effort_level} /> : null}
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
                {task.content_markdown ? (
                    <Box
                        component="button"
                        type="button"
                        aria-label={
                            showBody ? t.agentApproval.hideDetails : t.agentApproval.showDetails
                        }
                        sx={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            p: 0,
                            color: g.text.secondary,
                        }}
                        onClick={() => setShowBody((s) => !s)}
                    >
                        {showBody ? (
                            <ExpandLessRoundedIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />
                        )}
                    </Box>
                ) : null}
            </Box>
            {blockedBy.length > 0 && (
                <Typography level="body-xs" sx={{ color: g.text.secondary, ml: 1.5 }}>
                    {fmt(t.agentApproval.blockedBy, { tasks: blockedBy.join(", ") })}
                </Typography>
            )}
            {showBody && task.content_markdown ? (
                <Box
                    sx={{
                        ml: 1.5,
                        mt: 0.25,
                        fontSize: "0.8125rem",
                        color: g.text.secondary,
                        "& p": { m: 0 },
                        "& ul, & ol": { m: 0, pl: 2.5 },
                    }}
                >
                    <ReactMarkdown components={agentMarkdownComponents}>
                        {task.content_markdown}
                    </ReactMarkdown>
                </Box>
            ) : null}
        </Box>
    );
};

export const TaskPlanPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();

    const tasks = (Array.isArray(args.tasks) ? args.tasks : []) as PlanTaskArg[];
    const milestone = (
        args.milestone && typeof args.milestone === "object" ? args.milestone : null
    ) as PlanMilestoneArg | null;
    // Friendly-ized server-side: the project id arrives as its name,
    // existing_milestone_id as the milestone's title, and
    // parent_task_id as the anchor task's display id (sub-task mode).
    const projectLabel = asString(args.project_id);
    const existingMilestone = asString(args.existing_milestone_id);
    const parentTask = asString(args.parent_task_id);

    const milestoneChips: string[] = [];
    if (milestone?.due_date) milestoneChips.push(`${t.agentApproval.due} ${milestone.due_date}`);
    if (milestone?.assignee_ids?.length) {
        milestoneChips.push(milestone.assignee_ids.join(", "));
    }

    const depCount = tasks.reduce((n, task) => n + (task.blocked_by_indexes?.length || 0), 0);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            {projectLabel ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {t.agentApproval.project}: {projectLabel}
                </Typography>
            ) : null}

            {(milestone || existingMilestone) && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                    <MilestoneFlag size={16} />
                    <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                        {milestone?.title || existingMilestone}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                        {milestone
                            ? t.agentApproval.newMilestone
                            : t.agentApproval.existingMilestone}
                    </Typography>
                    {milestone?.priority ? <PlanPriority value={milestone.priority} /> : null}
                    {milestone?.effort_level ? (
                        <EffortLabel level={milestone.effort_level} />
                    ) : null}
                    {milestoneChips.map((c) => (
                        <MetaChip key={c} label={c} />
                    ))}
                </Box>
            )}

            {parentTask ? (
                // Sub-task mode: the whole batch nests under this task.
                <Typography level="body-sm" sx={{ fontWeight: 600, color: g.text.primary }}>
                    {fmt(t.agentApproval.subtasksOf, { task: parentTask })}
                </Typography>
            ) : null}

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.4,
                    pl: milestone || existingMilestone || parentTask ? 1.25 : 0,
                    borderLeft:
                        milestone || existingMilestone || parentTask ? "2px solid" : "none",
                    borderColor: g.border.subtle,
                }}
            >
                {tasks
                    // Tree order: each top-level task followed by its
                    // sub-tasks (children reference the parent's array
                    // index, but need not be adjacent to it).
                    .map((task, i) => ({ task, i }))
                    .filter(
                        ({ task }) => task.parent_index === null || task.parent_index === undefined
                    )
                    .flatMap(({ task, i }) => [
                        { task, isSubtask: false, key: i },
                        ...tasks
                            .map((child, j) => ({ child, j }))
                            .filter(({ child }) => child.parent_index === i)
                            .map(({ child, j }) => ({ task: child, isSubtask: true, key: j })),
                    ])
                    .map(({ task, isSubtask, key }) => (
                        <TaskRow key={key} allTasks={tasks} isSubtask={isSubtask} task={task} />
                    ))}
            </Box>

            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                {fmt(t.agentApproval.planFooter, { tasks: tasks.length, deps: depCount })}
            </Typography>
        </Box>
    );
};
