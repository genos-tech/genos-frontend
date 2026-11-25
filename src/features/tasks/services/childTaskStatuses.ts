// Kept apart from the loader so a test that mocks the loader still gets these (MIP-1994).
import { ACTIVE_STATUS_NAMES, HIDDEN_STATUS_NAMES } from "../meta/taskStatuses";
import type { ChildTasksScoped } from "./loadSpecificChildTasks";

/** The statuses a sub-task list shows before the user asks for more. */
export const ACTIVE_CHILD_STATUSES = ACTIVE_STATUS_NAMES;
/** The statuses left out of the first request (fetched on demand). */
export const HIDDEN_CHILD_STATUSES = HIDDEN_STATUS_NAMES;

export const isScopedChildTasks = (answer: unknown): answer is ChildTasksScoped =>
    !!answer && !Array.isArray(answer) && Array.isArray((answer as ChildTasksScoped).tasks);
