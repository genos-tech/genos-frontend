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
