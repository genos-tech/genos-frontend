import { useEffect } from "react";

/**
 * Put a surface's task-preview flag down when it is up but the pane is NOT
 * showing (MIP-1422).
 *
 * On the chat page the pane opens only when the user opens a task. A surface
 * flag that is up while the pane is hidden is not an open pane, it is a
 * leftover: a pane that stood down because its selection went away before a
 * task loaded in it. `useTaskPreviewPaneVisible` holds a pane up across an
 * empty selection only once a task has loaded, so a pane opened on a task that
 * was still loading (or never loads) disappears when the user opens a thread
 * without a task, while the flags stay up.
 *
 * Left up, the next task SELECTED (opening a thread selects its task) would
 * show the pane by itself. So it is put down, and the next explicit open raises
 * it again (`useSurfaceTaskPreviewVisible`).
 *
 * (A `true` persisted from an earlier session does not need this: the global
 * flag starts false on a reload, and `useSurfaceTaskPreviewVisible` follows a
 * global "closed" down on its first run.)
 *
 * It never acts:
 *   - while the pane is showing. A pane the latch keeps up across a thread
 *     switch is open; lowering it would unmount it mid-switch and lose the
 *     outgoing task's unsaved body;
 *   - while a cross-page "open this thread's task here" intent is being
 *     consumed (`intentPending`). That effect raises the flag in the same
 *     commit, before the pane can show;
 *   - while the surface is in the background. Only the page in front decides.
 */
export const useDropStaleSurfacePreview = ({
    isActiveRoute,
    intentPending,
    surfaceVisible,
    paneVisible,
    setSurfaceVisible,
}: {
    isActiveRoute: boolean;
    intentPending: boolean;
    surfaceVisible: boolean;
    paneVisible: boolean;
    setSurfaceVisible: (value: boolean) => void;
}): void => {
    useEffect(() => {
        if (!isActiveRoute || intentPending) return;
        if (surfaceVisible && !paneVisible) setSurfaceVisible(false);
    }, [isActiveRoute, intentPending, surfaceVisible, paneVisible, setSurfaceVisible]);
};
