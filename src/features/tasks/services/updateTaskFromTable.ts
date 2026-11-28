import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { TaskProps, TaskTableProps } from "../../../types/tasks";
import { keptCustomStatusId } from "../utils/projectStatus";
import { loadSpecificTask } from "./loadSpecificTask";
import { sendUpdatedSpecificTask } from "./sendUpdatedSpecificTask";
import { reportTaskNotSaved, TaskNotSavedError } from "./taskNotSavedError";
import { TaskSaveRefusedError } from "./taskSaveRefusedError";

/**
 * Updates a task from table edits
 * @param updatedRow - The updated row data from the table
 * @param myself - Current user
 * @param socket - Socket.io connection
 * @param accessToken - Authentication token
 * @param teamMembers - List of team members for assignee lookup
 * @returns Promise<TaskTableProps> - The updated task table data
 * @throws TaskNotSavedError whenever nothing was stored (`TaskSaveRefusedError`
 *   for an HTTP 400). The person has already been told; the caller must put its
 *   own copy of the row back.
 */
export const updateTaskFromTable = async (
    updatedRow: TaskTableProps,
    myself: UserProps,
    socket: Socket | null,
    accessToken: string | null,
    teamMembers: UserProps[]
): Promise<TaskTableProps> => {
    try {
        // Load the full task data. The row's own `updatedAt` is the freshness
        // baseline: this full copy is the BASE of a full PUT (it re-sends the
        // milestone, parent, status, title... of whatever it holds), so a cached
        // copy older than what the project list has seen would write the old
        // values back over a move or an edit made elsewhere (MIP-1168).
        const _fullTask: TaskProps[] | undefined = await loadSpecificTask(
            myself,
            Number(updatedRow.projectId),
            Number(updatedRow.id),
            accessToken,
            { expectedMinUpdatedAt: updatedRow.updatedAt ?? null }
        );

        let fullTask: TaskProps;
        if (_fullTask && _fullTask.length === 1) {
            fullTask = _fullTask[0];
        } else {
            console.error("Failed to load task for update");
            throw new TaskNotSavedError();
        }

        // Tags are editable inline from the table too. The row carries the
        // desired set; forward it (and recompute `concatTags` from it) so the
        // PUT persists tags — `sendUpdatedSpecificTask` already sends
        // `updatedTask.tags` — and the local/IDB row + the tag filter stay
        // consistent. Falls back to the server's current tags for callers that
        // don't touch them (status/assignee edits, the drag-reparent path).
        const nextTags = updatedRow.tags ?? fullTask.tags ?? [];
        const nextConcatTags =
            nextTags.length > 0 ? "/" + nextTags.map((t) => t.tagName).join("/") + "/" : null;

        // Update the task with the new values from the table.
        // `parentTaskId` and `milestoneId` are forwarded so the
        // drag-to-reparent path in DraggableTaskTable can reuse this
        // helper — the row carries the desired new parent / milestone
        // and the PUT propagates both via `parent_task_id` and
        // `milestone` (see sendUpdatedSpecificTask). `TaskProps`'s
        // `parentTaskId` is `number | null`, so we coerce the
        // table-shaped `string | null`.
        const updatedTask: TaskProps = {
            ...fullTask,
            title: updatedRow.title || "",
            // Picked in the table, or the stored one while the category stands (MIP-2493).
            customStatusId:
                updatedRow.customStatusPick ??
                keptCustomStatusId(
                    fullTask.status.status,
                    updatedRow.status,
                    fullTask.customStatusId
                ),
            customStatusPick: updatedRow.customStatusPick,
            status: {
                ...fullTask.status,
                status: updatedRow.status,
            },
            priority: {
                ...fullTask.priority,
                priority: updatedRow.priority,
            },
            effortLevel: {
                ...fullTask.effortLevel,
                level: updatedRow.effortLevel,
            },
            dueDate: updatedRow.dueDate || "",
            milestoneId: updatedRow.milestoneId ?? null,
            parentTaskId:
                updatedRow.parentTaskId != null && updatedRow.parentTaskId !== ""
                    ? Number(updatedRow.parentTaskId)
                    : null,
            tags: nextTags,
            concatTags: nextConcatTags ?? undefined,
            // Row edits carry the desired map (the custom-field cells
            // write it); other callers fall back to the freshly-loaded
            // full task so the PUT can't wipe existing values.
            customFieldValues: updatedRow.customFieldValues ?? fullTask.customFieldValues,
        };

        // Handle assignee update if it changed
        let newAssignee: UserProps | undefined;
        if (updatedRow.assigneeId) {
            newAssignee = teamMembers.find((member) => member.userId === updatedRow.assigneeId);
            if (newAssignee) {
                updatedTask.assignee = newAssignee;
            }
        }

        // Return the updated row with the latest timestamp
        // if updatedRow.dueDate is updated, format it to YYYY-MM-DD
        // if not, return the original dueDate
        const dueDateStr = updatedRow.dueDate
            ? dayjs(updatedRow.dueDate).format("YYYY-MM-DD")
            : updatedRow.dueDate;
        updatedTask.dueDate = dueDateStr || updatedTask.dueDate;

        // Send the updated task to the backend. It swallows every failure but a 400,
        // so `onNotSaved` is how a failed save is known here (MIP-2582).
        let notSaved: { error: unknown } | null = null;
        await sendUpdatedSpecificTask(
            socket,
            myself,
            updatedTask,
            true, // metadataSave: a table inline edit changes status/assignee/due
            accessToken,
            undefined,
            // An inline edit never changes the start date, and `fullTask`
            // may be an IndexedDB snapshot that lags the server (no
            // freshness check above). Re-sending its start date would clear
            // a date set since (a cached `null`) or revert one (a stale
            // string), so leave the field out of this PUT altogether.
            {
                sendStartDate: false,
                onNotSaved: (_retry, error) => (notSaved = { error }),
            }
        );
        // The cast: TypeScript does not see the callback's assignment.
        const failure = notSaved as { error: unknown } | null;
        if (failure) throw failure.error ?? new TaskNotSavedError();

        return {
            ...updatedRow,
            customStatusId: updatedTask.customStatusId,
            customStatusPick: undefined,
            tags: nextTags,
            concatTags: nextConcatTags,
            customFieldValues: updatedTask.customFieldValues,
            assigneeId: newAssignee?.userId || updatedRow.assigneeId,
            assigneeName: newAssignee?.userName || updatedRow.assigneeName,
            assigneeEmail: newAssignee?.userEmail || updatedRow.assigneeEmail,
            assigneeImgPath: newAssignee?.avatarImgPath || updatedRow.assigneeImgPath,
            dueDate: dueDateStr,
        };
    } catch (error) {
        // Never resolve with the edited row: that makes a failed save look stored, and
        // the board's rollback (a `catch` around this call) never runs.
        // A refusal has already shown its own reason.
        if (error instanceof TaskSaveRefusedError) throw error;
        console.error("Error updating task from table:", error);
        reportTaskNotSaved(error);
        throw new TaskNotSavedError();
    }
};
