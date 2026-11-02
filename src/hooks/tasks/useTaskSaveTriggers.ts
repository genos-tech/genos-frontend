import { useEffect } from "react";

import { TaskEditStateManagement } from "../../types/taskEditState";

/**
 * The two effects that turn "the working copy changed" into a task PUT, for
 * the task preview. Lifted out of `TaskPreview` unchanged so the loop a
 * refused save could cause is testable against the real triggers rather than
 * a copy of them (MIP-925).
 *
 * @param sendUpdatedTask - from `useSendUpdatedTask`. Must settle (never
 *   reject) for a refused save: it puts the working copy back to what the
 *   server holds and leaves `taskUpdated` false, so neither effect below sees
 *   a reason to send again. Anything that marked the task dirty after a
 *   refusal would be re-sent, refused again, and so on for as long as the
 *   preview stays open, with a toast on every round.
 */
export const useTaskSaveTriggers = (
    taskEditState: TaskEditStateManagement,
    sendUpdatedTask: (taskSwitched: boolean, syncCard?: boolean) => Promise<void>
) => {
    useEffect(() => {
        // Save updated task (title, assignee, status, ..., but not task body).
        // `syncCard = true`: this is the metadata-save path, so rebuild the PM
        // task-card header + broadcast it so every PM viewer's card updates
        // live (the body autosave / switch / close saves pass false).
        //
        // Keyed on `taskUpdateSeq`, NOT on the `taskUpdated` boolean. React
        // coalesces `setTaskUpdated(true)` while the flag is already true, so
        // an edit made while a previous save was still in flight produced no
        // state change and this effect never re-ran — the edit was applied to
        // local state (so the preview looked right) but never PUT. That is
        // the intermittent "status reverts in the table, and on reopen":
        // nothing had reverted, the change was simply never saved. The
        // counter changes on every save request, so none can be swallowed.
        // The same coalescing hazard is documented for attachments in the
        // effect below, which worked around it for that one field only.
        if (taskEditState.taskUpdated === true) {
            sendUpdatedTask(false, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskEditState.taskUpdateSeq]);

    // Re-trigger the save when the attachment list still contains
    // negative-id rows after a save just completed. This handles the
    // case where the user dropped file B *during* file A's POST: the
    // duplicate `setTaskUpdated(true)` call gets coalesced by React
    // while the flag is already true, so B would otherwise sit pending
    // forever until something else flipped the flag. After A's save
    // flips the flag back to false, this effect notices B's negative
    // id and kicks off the next save.
    useEffect(() => {
        if (taskEditState.taskUpdated) return;
        const hasPending = (taskEditState.tmpCurrentTaskContent?.attachments ?? []).some(
            (a) => a.attachment_id < 0
        );
        if (hasPending) {
            taskEditState.setTaskUpdated(true);
        }
    }, [taskEditState.taskUpdated, taskEditState.tmpCurrentTaskContent?.attachments]);
};
