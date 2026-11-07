import { TagListProps } from "../../../../types/tasks";

/**
 * What a task surface needs to draw a task. Structural on purpose: the table
 * row (`TaskTableProps`), the dashboard's effective-status task and the other
 * shapes all satisfy it, so callers pass what they already hold.
 */
export type TaskCardTask = {
    id?: string | number | null;
    taskId?: string | number | null;
    displayId?: string | null;
    title: string | null;
    status: string | null;
    priority?: string | null;
    assigneeId?: string | null;
    assigneeName?: string | null;
    dueDate?: string | null;
    tags?: TagListProps[] | null;
    isMilestone?: boolean | null;
};
