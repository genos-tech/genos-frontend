import { useEffect } from "react";

import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { ConvertedTaskRef } from "../sprint-milestone/services";

/**
 * An old link to a milestone that became a task (MIP-1042). Reading the
 * milestone answered "converted" and named the task; follow it, in place: the
 * preview switches to the task, the same way the tab that converted it does.
 * If the task has been made a milestone again since, open that milestone instead.
 *
 * Fires once per answer (the answer's identity), so a re-render of the preview
 * never re-opens the task the person has since navigated away from.
 */
export const useFollowConvertedMilestone = (
    converted: ConvertedTaskRef | undefined,
    useTM: Pick<
        TaskManagementState,
        | "setCurrentPreviewTaskId"
        | "setCurrentPreviewMilestoneId"
        | "setIsTaskPreviewVisible"
        | "loadTask"
    >
): void => {
    useEffect(() => {
        if (!converted) return;
        if (converted.isMilestone && converted.milestoneId != null) {
            useTM.setCurrentPreviewMilestoneId(converted.milestoneId);
        } else {
            useTM.setCurrentPreviewTaskId(converted.taskId);
            void useTM.loadTask(converted.projectId, converted.taskId);
        }
        useTM.setIsTaskPreviewVisible(true);
        // Keyed on the answer only: the setters are called, not watched.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [converted]);
};
