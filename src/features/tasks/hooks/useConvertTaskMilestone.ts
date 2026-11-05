import { useCallback } from "react";

import { invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { SprintMilestoneManagementState } from "../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { emitRequestError } from "../../../services/requestErrorNotifier";
import { forgetInFlightTask } from "../services/taskLoadInFlight";
import {
    ConvertFailure,
    convertMilestoneToTask,
    convertTaskToMilestone,
} from "../sprint-milestone/services";
import { applyConversionToRows } from "../utils/taskMilestoneConversion";

type Args = {
    /** The host's access token (both hosts already hold it from `useAuth`). */
    accessToken: string | null;
    useTM: Pick<
        TaskManagementState,
        | "setAllTasks"
        | "setCurrentPreviewTaskId"
        | "setCurrentPreviewMilestoneId"
        | "setIsTaskPreviewVisible"
        | "loadTask"
        | "tableMilestoneFilterId"
        | "setTableMilestoneFilter"
    >;
    /** Optional: a host that has no milestone store can't convert, and the call is a no-op. */
    useSM?: Pick<SprintMilestoneManagementState, "applyMilestoneToState" | "forgetMilestone">;
};

/** Say why a conversion failed, in the server's own words when it gave any. */
const reportFailure = (failure: ConvertFailure): void => {
    if (failure.message) emitRequestError("serverMessage", failure.message);
    else if (failure.status === 403) emitRequestError("permissionDenied");
    else if (failure.status !== null && failure.status >= 500) emitRequestError("serverError");
    else emitRequestError("requestFailed");
};

/** The converted row's cached copies describe the other kind of thing now. */
const dropTaskCaches = (taskId: number): void => {
    void invalidateCachedFullTask(taskId);
    forgetInFlightTask(taskId);
};

/**
 * Convert a root task to a milestone and a milestone back to a task (MIP-1042).
 *
 * After the server confirms, local state follows without a reload: the milestone
 * list, the table's rows (the row and everything below it), the caches of the
 * converted row, and the open preview, which switches to the other kind.
 * Resolves true when the conversion happened; on a refusal the person is told
 * why (the server's sentence) and nothing changes locally.
 */
export const useConvertTaskMilestone = ({ accessToken, useTM, useSM }: Args) => {
    const toMilestone = useCallback(
        async (taskId: number): Promise<boolean> => {
            if (!useSM) return false;
            const res = await convertTaskToMilestone(taskId, accessToken);
            if (!res.ok) {
                reportFailure(res);
                return false;
            }
            const { milestone, task } = res.data;
            dropTaskCaches(task.taskId);
            useSM.applyMilestoneToState(milestone);
            useTM.setAllTasks((rows) =>
                applyConversionToRows(rows, task.taskId, {
                    isMilestone: true,
                    milestoneId: milestone.milestoneId,
                })
            );
            // The pane showed the task; it shows the milestone it became.
            useTM.setCurrentPreviewMilestoneId(milestone.milestoneId);
            useTM.setIsTaskPreviewVisible(true);
            return true;
        },
        [accessToken, useSM, useTM]
    );

    const toTask = useCallback(
        async (milestoneId: number, projectId: number): Promise<boolean> => {
            if (!useSM) return false;
            const res = await convertMilestoneToTask(milestoneId, accessToken);
            if (!res.ok) {
                reportFailure(res);
                return false;
            }
            const { task } = res.data;
            dropTaskCaches(task.taskId);
            useSM.forgetMilestone(milestoneId, projectId);
            useTM.setAllTasks((rows) =>
                applyConversionToRows(rows, task.taskId, { isMilestone: false, milestoneId: null })
            );
            // A table narrowed to this milestone would now show nothing.
            if (useTM.tableMilestoneFilterId === milestoneId) useTM.setTableMilestoneFilter(null);
            // The pane showed the milestone; it shows the task it became.
            useTM.setCurrentPreviewTaskId(task.taskId);
            void useTM.loadTask(task.projectId, task.taskId);
            useTM.setIsTaskPreviewVisible(true);
            return true;
        },
        [accessToken, useSM, useTM]
    );

    return { toMilestone, toTask };
};
