import { invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { TaskTableProps } from "../../../types/tasks";
import { patchTaskFields } from "../diagram/services/patchTaskFields";
import { taskMessageTemplate } from "../utils/TaskMessageTemplate";
import { statuses } from "../utils/taskMeta";
import { addTask } from "./addTask";
import { loadSpecificTask } from "./loadSpecificTask";
import { emitTaskMetadataSaved, emitTaskTouched } from "./taskEvents";
import { forgetInFlightTask } from "./taskLoadInFlight";

/**
 * What the delete of a task writes once its Undo window has ended (MIP-1303).
 *
 * Only `{task_id, status, status_code}`. Never the working copy of an open
 * preview and never a snapshot taken when the delete was clicked: the server
 * strips what a PUT leaves out, so this one changes the status and nothing
 * else, and whatever was edited during the window (a title, a due date, a
 * move) stays as it was saved (MIP-1168).
 */
const DELETED_STATUS = statuses.find((s) => s.status === "Deleted");
export const DELETED_STATUS_CODE = DELETED_STATUS?.code ?? 0;

export const deleteTaskPayload = (taskId: number) => ({
    task_id: taskId,
    status: "Deleted",
    status_code: DELETED_STATUS_CODE,
});

/** The same PUT for a page that is going away: axios is abandoned with the page,
 *  a `fetch` with `keepalive` is not. Fire and forget. */
export const deleteTaskOnExit = (accessToken: string | null, taskId: number): void => {
    if (!accessToken || typeof fetch !== "function") return;
    try {
        void fetch(`${import.meta.env.VITE_API_BASE_URL}/task/`, {
            method: "PUT",
            keepalive: true,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(deleteTaskPayload(taskId)),
        }).catch(() => undefined);
    } catch {
        // Never let this break a page transition.
    }
};

/** A milestone's own record, for a page that is going away: the commit writes the
 *  milestone (which mirrors onto its backing task), so the exit path must too, or the
 *  two would disagree. */
export const deleteMilestoneOnExit = (accessToken: string | null, milestoneId: number): void => {
    if (!accessToken || typeof fetch !== "function") return;
    try {
        void fetch(`${import.meta.env.VITE_API_BASE_URL}/milestone/${milestoneId}/`, {
            method: "PATCH",
            keepalive: true,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ status: "Deleted" }),
        }).catch(() => undefined);
    } catch {
        // Never let this break a page transition.
    }
};

/** The write. Rejects when the server refused it, so the caller puts the task back. */
export const putTaskDeleted = async (
    taskId: number,
    accessToken: string | null
): Promise<void> => {
    const res = await patchTaskFields(
        taskId,
        { status: "Deleted", status_code: DELETED_STATUS_CODE },
        accessToken
    );
    if (!res.ok) throw new Error(res.error ?? "task delete failed");
};

/**
 * After the write landed: what every cache and every open view reads has to
 * say Deleted too. The row's own status is patched by the caller (it owns the
 * rows state); this does the rest.
 */
export const afterTaskDeleted = (taskId: number, row: TaskTableProps | null): void => {
    if (row) void addTask(row);
    // `loadSpecificTask` returns the cached full task when there is one: the next
    // preview open must see the new status, not the old one.
    void invalidateCachedFullTask(taskId);
    forgetInFlightTask(taskId);
    // The write added activity rows; Recents reloads on a metadata save.
    emitTaskTouched(taskId, "update");
    emitTaskMetadataSaved();
};

/**
 * The PM channel's task card shows the status, and the server does not rewrite
 * it (the card body is built by the client and sent over the socket,
 * `task_card.updated`): the edit paths do it through `syncCard`. Built from the
 * server's own copy, which already says Deleted, never from a snapshot of the
 * click. Fire and forget: the task is deleted either way.
 */
export const syncDeletedTaskCard = async (
    myself: UserProps,
    projectId: number,
    taskId: number,
    accessToken: string | null
): Promise<void> => {
    try {
        const [task] = await loadSpecificTask(myself, projectId, taskId, accessToken, {
            forceRefresh: true,
        });
        if (!task || task.id == null) return;
        await channelService.updateTaskCard(
            task.id,
            taskMessageTemplate(myself, task),
            task.title,
            {
                taskId: task.id,
                displayId: task.displayId,
                taskStatus: task.status.status,
                systemUserId: task.project?.systemUserId,
            }
        );
    } catch (e) {
        console.error("[deleteTask] PM task-card sync failed:", e);
    }
};
