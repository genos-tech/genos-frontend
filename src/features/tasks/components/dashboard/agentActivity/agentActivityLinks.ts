import type { AgentKind } from "../../../services/loadAgentWork";

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

/**
 * The kind of a row's agent. The API sends `null` for a person's own write (web app or
 * in-app AI, unmarked): that is `person`, never a missing value.
 */
export const agentKindOf = (agent: { kind: AgentKind } | null | undefined): AgentKind =>
    agent?.kind ?? "person";

/**
 * A connected app's family (`claude`, `chatgpt`, or `other`) as an agent kind. Any app that
 * is not Claude or ChatGPT is `other_app`; its name never reaches the client.
 */
export const familyKind = (family: string): AgentKind =>
    family === "claude" || family === "chatgpt" ? family : "other_app";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A note's type as the API sends it: 1 is a personal note (the API's number, not a word). */
export const isPersonalNoteType = (noteType: number | string | null | undefined): boolean =>
    noteType === 1 || noteType === "personal";

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
 * A task opens in its project: the row's own `project_id`, else the group's (`null` for
 * work on no project, which then has no link).
 */
export const agentTargetPath = (
    target: {
        type: string;
        id: string | number;
        project_id?: number | null;
        task_id?: number | null;
        note_type?: number | string | null;
    },
    fallbackProjectId: number | null
): string | null => {
    if (!SAFE_ID.test(String(target.id))) return null;
    if (target.type === "task") {
        const projectId = target.project_id ?? fallbackProjectId;
        return projectId ? taskPath(projectId, target.id) : null;
    }
    if (target.type === "note") {
        if (target.project_id && target.task_id && SAFE_ID.test(String(target.task_id))) {
            return taskNotePath(target.project_id, target.task_id, target.id);
        }
        if (isPersonalNoteType(target.note_type)) return myNotePath(target.id);
    }
    return null;
};

/** Where a decision note opens: a personal note, or a note on a task whose ids the server gave. */
export const agentDecisionPath = (decision: {
    note_id: string | number;
    note_type?: number | string | null;
    project_id?: number | null;
    task_id?: number | null;
}): string | null => {
    if (!SAFE_ID.test(String(decision.note_id))) return null;
    if (decision.project_id && decision.task_id && SAFE_ID.test(String(decision.task_id))) {
        return taskNotePath(decision.project_id, decision.task_id, decision.note_id);
    }
    if (isPersonalNoteType(decision.note_type)) return myNotePath(decision.note_id);
    return null;
};
