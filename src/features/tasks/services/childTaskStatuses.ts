// Kept apart from the loader so a test that mocks the loader still gets these (MIP-1994).
import type { ChildTasksScoped } from "./loadSpecificChildTasks";

/** The statuses a sub-task list shows before the user asks for more. */
export const ACTIVE_CHILD_STATUSES = ["Open", "WIP", "Blocked", "Pending"] as const;
/** The statuses left out of the first request (fetched on demand). */
export const HIDDEN_CHILD_STATUSES = ["Closed", "Deleted"] as const;

export const isScopedChildTasks = (answer: unknown): answer is ChildTasksScoped =>
    !!answer && !Array.isArray(answer) && Array.isArray((answer as ChildTasksScoped).tasks);
