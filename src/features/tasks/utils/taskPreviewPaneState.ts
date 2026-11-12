/**
 * What should `TaskPreview` put on screen right now?
 *
 * The preview is driven by two things that move at different times:
 * `currentPreviewTaskId` (the REQUESTED task — set synchronously on click) and
 * the working copy `tmpCurrentTaskContent` (the LOADED task — swapped a beat
 * later, once `loadTask` lands and the switch effect syncs it). Between the
 * two there is a window; for a cold by-id load it is 1-2 s. This decides what
 * the pane shows inside that window.
 *
 *  - "content"   the working copy is the requested task (or the host does not
 *                guard): render the task.
 *  - "switching" a task is loaded but it is NOT the requested one: the user
 *                just switched and the new one is still loading.
 *  - "loading"   nothing is loaded yet but a task is requested (first open).
 *  - "empty"     nothing requested: render nothing.
 *
 * `guard` is the host opting in to "a mismatch means still loading" (chat's
 * `guardStaleTaskId`, the task page's `holdSwitchWithLoader`). Without it the
 * working copy alone decides, as it always did.
 *
 * `releaseOnLoadFailure` (task page only) stops the guard from becoming a
 * permanent loader: once the by-id load for the requested task has FAILED
 * (`loadFailedTaskId === requestedId`) the mismatch is no longer "loading", so
 * the pane falls back to what it showed before the guard existed — the
 * previously loaded task — rather than spinning forever. Chat does not release
 * (its guard exists precisely to NOT show a different task after a failed
 * cross-project load).
 */
export type TaskPreviewPaneState = "content" | "switching" | "loading" | "empty";

export type TaskPreviewPaneInput = {
    /** `tmpCurrentTaskContent?.id` — the loaded/working-copy task. */
    workingCopyId: number | string | null | undefined;
    /** `currentPreviewTaskId` — the requested task; -1 / null = none. */
    requestedId: number | null | undefined;
    guard: boolean;
    releaseOnLoadFailure: boolean;
    /** `previewLoadFailedTaskId` from useTM. */
    loadFailedTaskId: number | null | undefined;
};

// Task ids are positive: -1 is "none", and 0 (a thread with no task, MIP-1422) is
// none too. Counting 0 as a request made the chat pane wait for task 0 for good.
const hasRequest = (id: number | null | undefined): id is number => id != null && Number(id) > 0;

export const getTaskPreviewPaneState = ({
    workingCopyId,
    requestedId,
    guard,
    releaseOnLoadFailure,
    loadFailedTaskId,
}: TaskPreviewPaneInput): TaskPreviewPaneState => {
    const hasWorkingCopy = !!workingCopyId;
    const matches =
        !guard ||
        !hasRequest(requestedId) ||
        String(workingCopyId ?? "") === String(requestedId) ||
        (releaseOnLoadFailure &&
            loadFailedTaskId != null &&
            String(loadFailedTaskId) === String(requestedId));

    if (hasWorkingCopy && matches) return "content";
    if (!hasRequest(requestedId)) return "empty";
    return hasWorkingCopy ? "switching" : "loading";
};
