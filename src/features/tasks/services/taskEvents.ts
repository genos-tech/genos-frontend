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

// "A task's or milestone's metadata (status, assignee, ...) was just
// written." Separate from `genos:task-touched` because that one's `update`
// also fires on every body autosave, and this one has to mean a save the
// sidebar's Recents should reload for. Emitted AFTER the write has landed,
// so a refetch sees the new status. No id: Recents reloads as a whole.

const METADATA_SAVED_EVENT = "genos:task-metadata-saved";

export const emitTaskMetadataSaved = (): void => {
    window.dispatchEvent(new CustomEvent(METADATA_SAVED_EVENT));
};

export const onTaskMetadataSaved = (cb: () => void): (() => void) => {
    window.addEventListener(METADATA_SAVED_EVENT, cb);
    return () => window.removeEventListener(METADATA_SAVED_EVENT, cb);
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
    // A new dependency can flip the blocked task to Blocked.
    "update_task_dependencies",
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

// "The live connection came back, or the tab was left for a while: anything
// announced in the meantime was missed." A comment broadcast while the socket
// is down is never replayed, so the open task's comments and activity have to
// be asked for again (MIP-1349). No id: whichever comment views are mounted
// refetch for the task they show, and the request caches are dropped so the
// refetch is a real one. Emitted by `commentsResync.ts`.

const COMMENTS_RESYNC_EVENT = "genos:comments-resync";

export const emitCommentsResync = (): void => {
    window.dispatchEvent(new CustomEvent(COMMENTS_RESYNC_EVENT));
};

export const onCommentsResync = (cb: () => void): (() => void) => {
    window.addEventListener(COMMENTS_RESYNC_EVENT, cb);
    return () => window.removeEventListener(COMMENTS_RESYNC_EVENT, cb);
};

// "The user just opened a task" (MIP-1063). Emitted once the server has
// recorded the open, so the sidebar's Recents reloads and sees it. The sidebar
// is not mounted on every surface that opens a task (modals, mobile), so the
// recorder cannot call it directly. No id: Recents reloads as a whole.

const TASK_OPENED_EVENT = "genos:task-opened";

export const emitTaskOpened = (): void => {
    window.dispatchEvent(new CustomEvent(TASK_OPENED_EVENT));
};

export const onTaskOpened = (cb: () => void): (() => void) => {
    window.addEventListener(TASK_OPENED_EVENT, cb);
    return () => window.removeEventListener(TASK_OPENED_EVENT, cb);
};
