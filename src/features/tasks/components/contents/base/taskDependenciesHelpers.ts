import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { refBlocks } from "../../../utils/blockerStatus";

// Helper: true when the task has at least one *open* blocker: one that does not read as Closed or
// Deleted, by the server's closed-ancestor rule (`effectiveStatus`, MIP-1549; see blockerStatus.ts).
// Plain function (no hooks) so TaskMainBlock can call it inline without
// breaking the rules of hooks.
export const isCurrentlyBlocked = (
    taskId: number | null | undefined,
    useTM: TaskManagementState
): boolean => {
    if (taskId == null) return false;
    const entry = useTM.taskDependencies[taskId];
    if (!entry) return false;
    return entry.blockedBy.some(refBlocks);
};
