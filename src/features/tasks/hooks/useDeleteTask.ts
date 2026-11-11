import { useCallback, useRef } from "react";

import { useAuth } from "../../../context/AuthContext";
import { runUndoable } from "../../../hooks/common/useUndoableAction";
import type { SprintMilestoneManagementState } from "../../../hooks/tasks/useSprintMilestoneManagement";
import type { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { TaskTableProps } from "../../../types/tasks";
import {
    afterTaskDeleted,
    deleteMilestoneOnExit,
    deleteTaskOnExit,
    putTaskDeleted,
    syncDeletedTaskCard,
} from "../services/deleteTaskCommit";
import { isNoMainPanelVisible } from "../utils/mainPanelVisibility";
import { taskDeleteKey } from "../utils/pendingTaskDelete";

/**
 * Delete a task (or a milestone) with an Undo window instead of an "Are you
 * sure?" (MIP-1303). Every door goes through this: the preview's menu and
 * status picker, the table's status cell, the graph card.
 *
 *     const deleteTask = useDeleteTask({ useTM, useSM, myself });
 *     deleteTask({ id, projectId, title });
 *
 * The task reads as Deleted at once (the overlay on `useTM.allTasks`, keyed by
 * `taskDeleteKey`), a toast offers Undo, and only when the toast is gone does
 * the one real write go out (`putTaskDeleted`: `{task_id, status, status_code}`
 * and nothing else). Undo sends nothing, because nothing was written: the real
 * write also adds activity rows, un-blocks the tasks that depended on it,
 * fires `task.completed` and rewrites the PM card, and no restore call takes
 * those back. See `useUndoableAction`.
 *
 * What the CALLER must not do: write "Deleted" into a working copy. Every
 * autosave of an open preview sends the whole copy, status included, and would
 * delete at once.
 */
export type DeleteTaskTarget = {
    /** The task's id; for a milestone, its backing task's. */
    id: number;
    projectId: number;
    isMilestone?: boolean;
    /** Needed for a milestone: the record the status is written on. */
    milestoneId?: number | null;
};

export type DeleteTaskOptions = {
    /** Runs right after the task is hidden. The default closes the page's own
     *  preview when it shows this task; a preview that lives in a modal closes
     *  itself. */
    afterHide?: () => void;
};

type Deps = {
    useTM: TaskManagementState;
    /** Only needed to delete a milestone. */
    useSM?: SprintMilestoneManagementState;
    myself: UserProps;
};

export const useDeleteTask = (deps: Deps) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    // The latest of everything, read when the toast is clicked or has gone: a row
    // keeps the callback of the render it last drew in, and the commit runs up to
    // 8 s after the click.
    const latest = useRef({ ...deps, accessToken, t });
    latest.current = { ...deps, accessToken, t };

    return useCallback((target: DeleteTaskTarget, options?: DeleteTaskOptions) => {
        const { useTM, t } = latest.current;
        const u = t.tasks.deleteUndo;
        const id = Number(target.id);
        const isMilestone = target.isMilestone === true;
        runUndoable({
            key: taskDeleteKey(id),
            message: isMilestone ? u.milestoneDeleted : u.deleted,
            errorMessage: isMilestone ? u.milestoneErrorRestored : u.errorRestored,
            keepOnNavigate: true,
            releaseOnCommit: true,
            commit: async () => {
                // Read now, not at the click: the token can be refreshed in the window.
                const { useTM, useSM, myself, accessToken } = latest.current;
                let updatedAt: string | undefined;
                if (isMilestone) {
                    // A milestone's status lives on its own record, which then
                    // mirrors it onto the backing task.
                    if (target.milestoneId == null || !useSM) {
                        throw new Error("milestone delete needs the milestone");
                    }
                    const updated = await useSM.updateExistingMilestone(
                        { milestoneId: target.milestoneId, status: "Deleted" },
                        target.projectId
                    );
                    if (!updated) throw new Error("milestone delete failed");
                    updatedAt = updated.tsUpdatedAt ?? undefined;
                } else {
                    await putTaskDeleted(id, accessToken);
                }
                // The row the table reads, the cache it reloads from, and every
                // open view: Deleted. BEFORE the overlay is released (see
                // `releaseOnCommit`), so the task never flickers back.
                const patch = { status: "Deleted", ...(updatedAt ? { updatedAt } : {}) };
                const isIt = (row: TaskTableProps) => String(row.id) === String(id);
                // The row for the IDB write is read now, not from the updater below
                // (React runs that one when it likes), and from the LATEST rows.
                const source = latest.current.useTM.allTasks.find(isIt);
                useTM.setAllTasks((prev) =>
                    prev.map((row) => (isIt(row) ? { ...row, ...patch } : row))
                );
                afterTaskDeleted(id, source ? { ...source, ...patch } : null);
                if (!isMilestone)
                    void syncDeletedTaskCard(myself, target.projectId, id, accessToken);
            },
            onExit: () => {
                const { accessToken } = latest.current;
                if (isMilestone && target.milestoneId != null) {
                    deleteMilestoneOnExit(accessToken, target.milestoneId);
                } else {
                    deleteTaskOnExit(accessToken, id);
                }
            },
        });
        // `runUndoable` ignores a task that is already pending: nothing to close.
        if (options?.afterHide) options.afterHide();
        else closePreviewShowing(useTM, target);
    }, []);
};

/** The page's own preview pane, when it shows the task that was just hidden. */
const closePreviewShowing = (useTM: TaskManagementState, target: DeleteTaskTarget) => {
    const showing = target.isMilestone
        ? useTM.currentPreviewKind === "milestone" &&
          useTM.currentPreviewMilestoneId === target.milestoneId
        : useTM.currentPreviewKind === "task" && useTM.currentPreviewTaskId === target.id;
    if (!showing) return;
    useTM.closeTaskPreview();
    if (isNoMainPanelVisible(useTM)) useTM.setIsTaskTableVisible(true);
};
