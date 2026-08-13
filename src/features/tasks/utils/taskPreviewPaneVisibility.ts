/**
 * Does the task-preview pane have anything to render?
 *
 * `TaskPreview` returns `null` — not a loading pane, nothing at all — when
 * no task and no milestone is selected (TaskPreview.tsx:1044-1046: the
 * loading fallback is itself gated on `currentPreviewTaskId !== -1`). Its
 * hosts paint the surrounding `<Panel>`/overlay themselves, so a host that
 * mounts the pane in that state paints an empty column the user cannot
 * dismiss: the close control lives inside the preview header that didn't
 * render. Same failure shape as the note pane — see `isNotePaneVisible`.
 *
 * The task page has always carried this check inline (TaskHomeLayout.tsx);
 * the chat page gated on visibility alone, which is how the empty pane got
 * out. Hence one predicate both surfaces can share.
 *
 * The disjunction is deliberate and load-bearing: the pane must stay
 * mounted through a task SWITCH, where `currentPreviewTaskId` flips to the
 * new id a beat before `loadTask` swaps `currentPreviewTask` in. Testing
 * that the two AGREE (an id match) is what used to unmount the panel
 * mid-switch — a visible "close then reopen" flash on every task change.
 * An id on its own is enough to keep the frame up; `TaskPreview` shows its
 * own loading pane while the object catches up.
 *
 * A milestone preview carries its id in `currentPreviewMilestoneId` and
 * deliberately leaves `currentPreviewTaskId` at -1
 * (`useTaskManagement.setCurrentPreviewMilestoneId`), so it needs its own
 * arm here or milestone previews would count as "nothing to show".
 */
export type TaskPreviewSelection = {
    /** The loaded task object; typed loosely so callers can pass `useTM`. */
    currentPreviewTask?: unknown;
    currentPreviewTaskId: number;
    currentPreviewKind: "task" | "milestone";
    currentPreviewMilestoneId: number;
};

export const hasTaskPreviewContent = (v: TaskPreviewSelection): boolean =>
    v.currentPreviewTask != null ||
    (v.currentPreviewTaskId != null && v.currentPreviewTaskId !== -1) ||
    (v.currentPreviewKind === "milestone" && v.currentPreviewMilestoneId !== -1);
