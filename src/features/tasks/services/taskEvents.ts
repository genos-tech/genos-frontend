// Scoped task-refresh signal.
//
// `TaskPreview` used to key its activity/comment refetches off the
// global `isTaskUpdated` / `isTaskCommentUpdated` flags. Those flags
// flip for *any* task event in the team (and on every cycle of the
// tmpCurrentTaskContent mirror loop), so the open preview refetched
// `/task/activity/` and `/task/comment/` hundreds of times per
// session for data that hadn't changed — the request storm visible in
// devtools traces.
//
// This bus carries the missing piece of information: WHICH task was
// touched. Producers (socket handlers, comment editors, the task-save
// hook) emit `genos:task-touched` with the task id; consumers refetch
// only when the id matches what they're displaying. Window events are
// used instead of another context hook to match the existing
// `v3:activity:created` / `v3:message:created` pattern — producers and
// consumers live on opposite sides of the component tree.

export type TaskTouchedKind = "comment" | "update" | "children";

export type TaskTouchedDetail = {
    taskId: number;
    kind: TaskTouchedKind;
};

const EVENT_NAME = "genos:task-touched";

export const emitTaskTouched = (taskId: number, kind: TaskTouchedKind): void => {
    if (!Number.isFinite(taskId) || taskId <= 0) return;
    window.dispatchEvent(
        new CustomEvent<TaskTouchedDetail>(EVENT_NAME, { detail: { taskId, kind } })
    );
};

export const onTaskTouched = (cb: (detail: TaskTouchedDetail) => void): (() => void) => {
    const handler = (e: Event) => {
        const detail = (e as CustomEvent<TaskTouchedDetail>).detail;
        if (!detail) return;
        cb(detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
};

// Coarse sibling signal: "several tasks (and possibly milestones)
// changed at once — refetch the project". Emitted when the agent's
// approved write tools mutate tasks outside the normal UI flows
// (create_task_plan / update_tasks_bulk can touch a milestone plus
// many tasks in one call — per-task `genos:task-touched` events would
// be the wrong grain and still miss milestone/dependency rows).
// Consumers (useProjectTaskManagement) re-run the same network refresh
// the window-focus handler uses. `projectId` is optional because the
// tool-result summary doesn't carry it; listeners fall back to the
// currently open project.

export type TasksBulkChangedDetail = {
    projectId?: number;
};

// Agent write tools whose approval mutates task/milestone rows — the
// tool-result handlers in useAgentQA / useSpotlight emit the bulk
// signal for exactly this set. Kept here (next to the emitter) so the
// two handlers can't drift apart.
export const TASK_WRITE_TOOLS: ReadonlySet<string> = new Set([
    "create_task_plan",
    "update_tasks_bulk",
    "create_task",
    "update_task",
    "assign_task",
]);

const BULK_EVENT_NAME = "genos:tasks-bulk-changed";

export const emitTasksBulkChanged = (projectId?: number): void => {
    window.dispatchEvent(
        new CustomEvent<TasksBulkChangedDetail>(BULK_EVENT_NAME, { detail: { projectId } })
    );
};

export const onTasksBulkChanged = (cb: (detail: TasksBulkChangedDetail) => void): (() => void) => {
    const handler = (e: Event) => {
        cb((e as CustomEvent<TasksBulkChangedDetail>).detail || {});
    };
    window.addEventListener(BULK_EVENT_NAME, handler);
    return () => window.removeEventListener(BULK_EVENT_NAME, handler);
};
