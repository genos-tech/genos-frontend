import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { taskContentTemplate } from "../../utils/taskTemplates";

/**
 * Create a real (not init/empty) sub-task from the diagram, parented
 * to `parentTaskId`. The user can rename inline on the new node.
 * Returns the new task's id so the canvas can drop the node in
 * immediately without waiting for a project refetch.
 *
 * Mirrors the create payload `TaskMasterView.post` expects. Sprint and
 * milestone are inferred server-side from the parent task chain (see
 * the bridge in `_bridge_milestone_to_parent`).
 */
export const createDiagramSubtask = async (
    myself: UserProps,
    projectId: number,
    parentTaskId: number,
    accessToken: string | null,
    // Default title for the new row. The canvas passes "New task" when
    // the parent is a milestone (the child reads as a task in that
    // milestone, not a sub-task), and "New sub-task" otherwise.
    title: string = "New sub-task"
): Promise<{ ok: true; taskId: number } | { ok: false; error: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Unauthorized." };
        const res = await api.post("/task/", {
            team: myself.teamId,
            project: projectId,
            assignee: myself.userId,
            reporter: myself.userId,
            title,
            priority: null,
            effort_level: null,
            status: "Open",
            // Ship the same default body scaffold the rich CreateTaskForm and
            // the quick-add row (`createQuickTask`) start with, instead of an
            // empty body. A subtask created from the diagram that opens to a
            // blank BlockNote editor feels unfinished; the default template's
            // Summary / Motivation / Acceptance / Notes sections prompt the
            // user to flesh it out.
            content: taskContentTemplate,
            due_date: null,
            start_date: null,
            links: null,
            tags: [],
            chat_type: null,
            chat_id: null,
            thread_id: null,
            parent_task_id: parentTaskId,
            // root_task_id auto-derived by the post-save signal.
            root_task_id: null,
            is_init_task: false,
        });
        const id = res.data?.task?.task_id;
        if (typeof id !== "number") {
            return { ok: false, error: "Backend did not return a task id." };
        }
        return { ok: true, taskId: id };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            return {
                ok: false,
                error:
                    (error.response?.data as { error?: string } | undefined)?.error ??
                    "Failed to create sub-task.",
            };
        }
        return { ok: false, error: "Unexpected error." };
    }
};
