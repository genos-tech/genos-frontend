import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import { TaskProps, TaskTableProps } from "../../../types/tasks";
import { loadSpecificTask } from "./loadSpecificTask";
import { sendUpdatedSpecificTask } from "./sendUpdatedSpecificTask";

/**
 * Updates a task from table edits
 * @param updatedRow - The updated row data from the table
 * @param myself - Current user
 * @param socket - Socket.io connection
 * @param accessToken - Authentication token
 * @param teamMembers - List of team members for assignee lookup
 * @returns Promise<TaskTableProps> - The updated task table data
 */
export const updateTaskFromTable = async (
    updatedRow: TaskTableProps,
    myself: UserProps,
    socket: Socket | null,
    accessToken: string | null,
    teamMembers: UserProps[]
): Promise<TaskTableProps> => {
    try {
        // Load the full task data
        const _fullTask: TaskProps[] | undefined = await loadSpecificTask(
            myself,
            Number(updatedRow.projectId),
            Number(updatedRow.id),
            accessToken
        );

        let fullTask: TaskProps;
        if (_fullTask && _fullTask.length === 1) {
            fullTask = _fullTask[0];
        } else {
            console.error("Failed to load task for update");
            return updatedRow;
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

        // Send the updated task to the backend
        await sendUpdatedSpecificTask(
            socket,
            myself,
            updatedTask,
            true, // syncCard: a table inline edit is a metadata change (status/
            // assignee/due) → rewrite the PM task card + broadcast.
            accessToken
        );

        return {
            ...updatedRow,
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
        console.error("Error updating task from table:", error);
        return updatedRow;
    }
};
