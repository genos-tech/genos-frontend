// Centralizes the "what does the user see when we refer to a task by
// id?" decision. Used by every UI surface that renders a task identifier
// — table, sprint board, preview header, chips, search results, thread
// header, activity feed, recents sidebar, dashboard widgets.
//
// Default path: the backend provides `displayId` (e.g. "GEN-42") on every
// task response. Fallback to "#<id>" for tasks with no project / pre-
// migration rows / partial state where the new field hasn't loaded yet.

// Tasks come through several different API shapes. Some surfaces use
// `id` (TaskTableProps, TaskProps), others use `taskId` (Recents,
// SearchBox, ActivityTypeChips). Accept either so callers don't have
// to remember which field their row carries.
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

export const formatTaskDisplayId = (task: TaskLike | null | undefined): string => {
    if (!task) return "";
    if (task.displayId) return task.displayId;
    const numeric = task.id ?? task.taskId;
    if (numeric != null && numeric !== "") return `#${numeric}`;
    return "";
};
