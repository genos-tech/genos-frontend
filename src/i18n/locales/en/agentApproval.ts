// Strings for the structured write-tool approval previews
// (features/agentQA/approval/*). The ApprovalCard shell itself stays
// props-only/string-free; only the per-tool preview renderers consume
// this namespace directly via useTranslation() — threading ~15 labels
// through every surface's label props would be churn with no benefit.
export const agentApproval = {
    newMilestone: "New milestone",
    existingMilestone: "Existing milestone",
    project: "Project",
    tasks: "Tasks",
    due: "Due",
    start: "Start",
    assignee: "Assignee",
    assignees: "Assignees",
    subtask: "Sub-task",
    subtasksOf: "Sub-tasks of {task}",
    blockedBy: "Blocked by {tasks}",
    showDetails: "Show details",
    hideDetails: "Hide details",
    planFooter: "{tasks} task(s) · {deps} dependency(ies)",
    updatesHeader: "{count} task change(s)",
    noChanges: "(no field changes)",
    fieldLabels: {
        priority: "Priority",
        effort_level: "Effort",
        status: "Status",
        due_date: "Due",
    },
    cleared: "none",
    unset: "—",
} as const;
