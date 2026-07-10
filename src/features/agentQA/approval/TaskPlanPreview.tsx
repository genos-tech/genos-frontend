// Structured preview for a `create_task_plan` proposal: milestone
// header, the task tree (sub-tasks indented under their parent), per
// task chips for priority / effort / dates / assignee, "blocked by"
// sublines resolved to the referenced tasks' titles, and collapsible
// markdown bodies. Renders purely from the (friendly-ized) proposal
// arguments — nothing exists in the DB yet at approval time.

import { useState } from "react";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Chip, Typography } from "@mui/joy";
import ReactMarkdown from "react-markdown";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";

interface PlanTaskArg {
    title?: string;
    content_markdown?: string;
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

const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

const TaskRow = ({
    task,
    allTasks,
    isSubtask,
    isDark,
}: {
    task: PlanTaskArg;
    allTasks: PlanTaskArg[];
    isSubtask: boolean;
    isDark: boolean;
}) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [showBody, setShowBody] = useState(false);

    const blockedBy = (task.blocked_by_indexes || [])
        .map((i) => allTasks[i]?.title)
        .filter(Boolean) as string[];

    const chips: string[] = [];
    if (task.priority) chips.push(task.priority);
    if (task.effort_level) chips.push(task.effort_level);
    if (task.due_date) chips.push(`${t.agentApproval.due} ${task.due_date}`);
    if (task.assignee_id) chips.push(String(task.assignee_id));

    return (
        <Box sx={{ ml: isSubtask ? 2.25 : 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
                    {isSubtask ? "↳ " : ""}
                    {task.title || "—"}
                </Typography>
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
                            color: palette.textMuted,
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
                <Typography level="body-xs" sx={{ color: palette.textMuted, ml: 1.5 }}>
                    {fmt(t.agentApproval.blockedBy, { tasks: blockedBy.join(", ") })}
                </Typography>
            )}
            {showBody && task.content_markdown ? (
                <Box
                    sx={{
                        ml: 1.5,
                        mt: 0.25,
                        fontSize: "0.8125rem",
                        color: palette.textMuted,
                        "& p": { m: 0 },
                        "& ul, & ol": { m: 0, pl: 2.5 },
                    }}
                >
                    <ReactMarkdown>{task.content_markdown}</ReactMarkdown>
                </Box>
            ) : null}
        </Box>
    );
};

export const TaskPlanPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const tasks = (Array.isArray(args.tasks) ? args.tasks : []) as PlanTaskArg[];
    const milestone = (
        args.milestone && typeof args.milestone === "object" ? args.milestone : null
    ) as PlanMilestoneArg | null;
    // Friendly-ized server-side: the project id arrives as its name and
    // existing_milestone_id as the milestone's title.
    const projectLabel = asString(args.project_id);
    const existingMilestone = asString(args.existing_milestone_id);

    const milestoneChips: string[] = [];
    if (milestone?.priority) milestoneChips.push(milestone.priority);
    if (milestone?.effort_level) milestoneChips.push(milestone.effort_level);
    if (milestone?.due_date) milestoneChips.push(`${t.agentApproval.due} ${milestone.due_date}`);
    if (milestone?.assignee_ids?.length) {
        milestoneChips.push(milestone.assignee_ids.join(", "));
    }

    const depCount = tasks.reduce((n, task) => n + (task.blocked_by_indexes?.length || 0), 0);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            {projectLabel ? (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {t.agentApproval.project}: {projectLabel}
                </Typography>
            ) : null}

            {(milestone || existingMilestone) && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                    <FlagRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                    <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                        {milestone?.title || existingMilestone}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                        {milestone
                            ? t.agentApproval.newMilestone
                            : t.agentApproval.existingMilestone}
                    </Typography>
                    {milestoneChips.map((c) => (
                        <MetaChip key={c} label={c} />
                    ))}
                </Box>
            )}

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.4,
                    pl: milestone || existingMilestone ? 1.25 : 0,
                    borderLeft: milestone || existingMilestone ? "2px solid" : "none",
                    borderColor: palette.borderMuted,
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
                        <TaskRow
                            key={key}
                            allTasks={tasks}
                            isDark={isDark}
                            isSubtask={isSubtask}
                            task={task}
                        />
                    ))}
            </Box>

            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                {fmt(t.agentApproval.planFooter, { tasks: tasks.length, deps: depCount })}
            </Typography>
        </Box>
    );
};
