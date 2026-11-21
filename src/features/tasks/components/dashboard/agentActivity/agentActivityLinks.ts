/** Short local time: "Nov 21, 10:42". The locale is the app's, so the date order follows it. */
export const formatAgentWhen = (iso: string | null | undefined, locale: string): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const taskPath = (projectId: number, taskId: string | number): string =>
    `/workspace/tasks/project/${encodeURIComponent(String(projectId))}/task/${encodeURIComponent(String(taskId))}`;

const taskNotePath = (
    projectId: number,
    taskId: string | number,
    noteId: string | number
): string =>
    `/workspace/notes/task/project/${encodeURIComponent(String(projectId))}/task/${encodeURIComponent(String(taskId))}/note/${encodeURIComponent(String(noteId))}`;

const myNotePath = (noteId: string | number): string =>
    `/workspace/notes/my/${encodeURIComponent(String(noteId))}`;

/**
 * Where a row's target opens, the way the app opens it everywhere else. `null` when the
 * server did not name enough to open it: the row then shows the title as text, not a link.
 */
export const agentTargetPath = (
    target: {
        type: string;
        id: string | number;
        project_id?: number | null;
        task_id?: number | null;
        note_type?: string | null;
    },
    fallbackProjectId: number
): string | null => {
    if (!SAFE_ID.test(String(target.id))) return null;
    if (target.type === "task") {
        return taskPath(target.project_id ?? fallbackProjectId, target.id);
    }
    if (target.type === "note") {
        if (target.project_id && target.task_id && SAFE_ID.test(String(target.task_id))) {
            return taskNotePath(target.project_id, target.task_id, target.id);
        }
        if (target.note_type === "personal") return myNotePath(target.id);
    }
    return null;
};

/** Where a decision note opens: a personal note, or a note on a task whose ids the server gave. */
export const agentDecisionPath = (decision: {
    note_id: string | number;
    note_type?: string | null;
    project_id?: number | null;
    task_id?: number | null;
}): string | null => {
    if (!SAFE_ID.test(String(decision.note_id))) return null;
    if (decision.project_id && decision.task_id && SAFE_ID.test(String(decision.task_id))) {
        return taskNotePath(decision.project_id, decision.task_id, decision.note_id);
    }
    if (decision.note_type === "personal") return myNotePath(decision.note_id);
    return null;
};
