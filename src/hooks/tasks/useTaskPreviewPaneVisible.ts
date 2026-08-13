import { useEffect, useRef } from "react";

import {
    hasTaskPreviewContent,
    TaskPreviewSelection,
} from "../../features/tasks/utils/taskPreviewPaneVisibility";

/**
 * Should the task-preview pane be MOUNTED on this surface?
 *
 * `paneRequested` is the plain want-it/don't-want-it answer (this surface's
 * flag AND the global one). On its own it let the chat page paint an empty
 * column: `TaskPreview` renders null when nothing is selected while the pane
 * draws its own frame, so the user got a bordered, resizable, unclosable
 * blank column — the close control lives in the preview header that never
 * rendered. Hence the content check.
 *
 * The subtlety, and the reason this is a hook rather than one `&&`: on the
 * chat page "nothing is selected" is also a normal TRANSIENT state in the
 * middle of a thread switch. `MessageBubble.replayHandler` writes
 * `setCurrentPreviewTaskId(-1)` synchronously for any message whose own row
 * carries no task — which for DM/GM/MDM is the usual case even when the
 * THREAD has one, because the task rides on the card reply, not the root
 * (MessageBubble.tsx:227-235). The real id only lands after an awaited
 * `loadV3SpecificThreadMessages`. Gating the mount on content alone
 * therefore unmounts the pane for a whole network round trip on every
 * thread→thread switch, and that is not merely a flash:
 *
 *   - the PanelGroup resizes its siblings out and back twice, the exact
 *     "close then reopen" churn the comments in `chatHome` and
 *     `taskPreviewPaneVisibility` warn about; and
 *   - `TaskPreview` flushes the OUTGOING task's unsaved body from an
 *     instance ref (`prevTaskIdRef`, TaskPreview.tsx:338/420-427) and has
 *     no unmount-time save, so a remount silently drops whatever the user
 *     typed since the last 3-second autosave.
 *
 * So content gates OPENING the pane, not keeping it open: once a task has
 * actually loaded into an open pane, the pane stays mounted until the
 * request itself goes away. During the transient an already-mounted
 * `TaskPreview` keeps showing the outgoing task (its sync effect returns
 * early on a null incoming task, TaskPreview.tsx:415-417) — stable, never
 * blank — which is what it did before any of this and what the latch
 * preserves.
 *
 * The latch is deliberately keyed on a LOADED task rather than on "was
 * visible": a pane that only ever had an id and never resolved an object
 * has nothing to preserve and no dirty body to lose, so it is allowed to
 * stand down and take the blank frame with it.
 *
 * Note this is also the only thing that protects a user who already
 * tripped the bug. `useSurfaceTaskPreviewVisible` persists its surface flag,
 * so their `localStorage["taskPreviewVisible:chat"]` is already "true"; the
 * hook fix stops NEW poisoning but cannot un-poison theirs. Lowering the
 * stored flag on an empty selection would fix that and reintroduce the
 * unmount above, since it feeds `paneRequested` — so the stale flag is left
 * alone on purpose and answered here instead.
 */
export const useTaskPreviewPaneVisible = (
    paneRequested: boolean,
    selection: TaskPreviewSelection
): boolean => {
    // Sticky "a task has loaded while the pane was open". Read during
    // render, written after commit, so it always reflects an EARLIER
    // commit — precisely the question being asked.
    const loadedRef = useRef(false);

    const visible = paneRequested && (hasTaskPreviewContent(selection) || loadedRef.current);

    useEffect(() => {
        if (!paneRequested) {
            // A real close (either flag dropping). Re-arm: the next open
            // has to justify itself with a selection again.
            loadedRef.current = false;
            return;
        }
        // Set-only while requested. Clearing this when the task goes null
        // would just move the mid-switch unmount one commit later.
        if (selection.currentPreviewTask != null) loadedRef.current = true;
    }, [paneRequested, selection.currentPreviewTask]);

    return visible;
};
