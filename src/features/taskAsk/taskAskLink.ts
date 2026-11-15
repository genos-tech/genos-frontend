// "Ask Genos about this task or milestone": the hand-off from a task's or milestone's "..." menu to the
// window that holds THAT object's conversation (MIP-1057).
//
// The menus sit deep in the task views; the window lives at the App root (`TaskAskHost`). They meet
// through a window event, the same shape as `askGenosAbout` (`genos:ask-about`) and
// `calendarEventLink`. This is NOT the Cmd-K hand-off: nothing here opens Spotlight, puts a token in its
// draft or queues a mention, so the general conversation is untouched. (Until the 2026-11 flip a task's
// Ask used that hand-off, `genos:ask-about`, which is still what a message or a calendar event uses.)
//
// The request carries what the host needs and the menu knows: the task's own numeric id (a
// MILESTONE's backing task, NEVER its `milestoneId`), what to call it, and its project. The host
// resolves the team the ask is addressed to (the host team of a shared project) from the project, since
// only the App root has the project list.

import { isTaskId } from "../../services/agentApi";
import { askGenosRefForTask } from "../spotlight/askGenosAbout";

export interface TaskAskRequest {
    /** The task's own id; for a milestone the id of its backing task row. */
    taskId: number;
    /** Where the task lives, so the host can tell a project shared from another team. */
    projectId: number | null;
    displayId: string | null;
    title: string;
    isMilestone: boolean;
}

/** The request for a task or a milestone, or null when it cannot be named: a real id and something to
 *  call it by (the same gate the menu item always had, so an unsaved task has no Ask item). */
export const askGenosTaskRequest = (task: {
    id: number | null | undefined;
    projectId?: number | null;
    displayId?: string | null;
    title?: string | null;
    isMilestone?: boolean;
}): TaskAskRequest | null => {
    if (!isTaskId(task.id)) return null;
    if (askGenosRefForTask({ ...task, id: task.id }) === null) return null;
    return {
        taskId: task.id,
        projectId: task.projectId ?? null,
        displayId: (task.displayId ?? "").trim() || null,
        title: (task.title ?? "").trim(),
        isMilestone: task.isMilestone === true,
    };
};

const EVENT_NAME = "genos:ask-about-task";

/** Open the task's own Ask. Nothing is sent until the person asks. */
export const requestAskGenosAboutTask = (request: TaskAskRequest): void => {
    window.dispatchEvent(new CustomEvent<TaskAskRequest>(EVENT_NAME, { detail: request }));
};

/** The listener (`TaskAskHost`). Returns the unsubscribe. */
export const onAskGenosAboutTask = (handler: (request: TaskAskRequest) => void): (() => void) => {
    const listener = (e: Event) => {
        const request = (e as CustomEvent<TaskAskRequest | undefined>).detail;
        if (request && isTaskId(request.taskId)) handler(request);
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
