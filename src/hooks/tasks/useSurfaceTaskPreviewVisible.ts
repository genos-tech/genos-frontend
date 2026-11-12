import { useCallback, useEffect, useRef, useState } from "react";

import { hasTaskPreviewContent } from "../../features/tasks/utils/taskPreviewPaneVisibility";
import { TaskManagementState } from "./useTaskManagement";

/**
 * Per-surface visibility for the task preview panel.
 *
 * `useTM.isTaskPreviewVisible` is GLOBAL — one flag shared by the task
 * page, the chat page and the mobile variants. That is deliberate (task
 * routing, the table/board row highlight and the diagram all read it),
 * but on its own it makes the panel leak across pages: open a preview on
 * the task page and it is already "open" when you switch to chat, which
 * is not something the user asked for on that page.
 *
 * The Homes are keep-alive — they stay mounted while hidden. They used to
 * re-render with every change, so a backgrounded Home's effects observed
 * the global flag flipping and kept `prevRef` current; the observation
 * below is gated on `isActiveRoute` so only the page the user is actually
 * looking at may adopt an "opened" transition as its own.
 *
 * They no longer re-render while hidden (`FreezeWhenHidden`, MIP-959), so
 * `prevRef` goes stale: it still says "closed" from before the user left,
 * and the first render back on this page saw closed -> open and took it for
 * a fresh open (MIP-981). The gate alone cannot catch that, because by then
 * the page IS active. So the moment this surface becomes the active route
 * it RE-BASELINES: `prevRef` is brought up to the current global state and
 * the difference is not treated as an open. An open or switch only counts
 * when it happens while the surface is active.
 *
 * Closing is intentionally NOT scoped: when the global flag goes false
 * the preview really was closed, so every surface follows it down.
 *
 * **Only an explicit open opens it (MIP-1422).** Something must have ASKED for
 * the preview while this surface is in front: the global flag going true, or
 * `setIsTaskPreviewVisible(true)` being called again while it already was
 * (`useTM.previewOpenCount`). Every "open task" control does that. A task
 * merely becoming the SELECTION does not: opening a thread selects its task
 * (the bubble replay, the activity and flagged-message handlers,
 * `useThreadTaskHandling`), and with the global flag already up from the task
 * page that selection change used to be adopted as a "switch" and open the
 * pane by itself. A thread with no task carried task id 0, so the pane it
 * opened waited for task 0 forever. A selection now shows only in a pane the
 * user opened.
 *
 * The surface flag is persisted so a reload lands on the same layout the
 * user left. Chat has no URL segment for "preview is open" (the task
 * page does — its preview state lives in the route), so localStorage is
 * the only place this can survive a refresh.
 */
export const useSurfaceTaskPreviewVisible = (
    surface: string,
    isActiveRoute: boolean,
    useTM: TaskManagementState
): [boolean, (value: boolean) => void] => {
    const storageKey = `taskPreviewVisible:${surface}`;

    const [visible, setVisibleState] = useState<boolean>(
        () => localStorage.getItem(storageKey) === "true"
    );

    const setVisible = useCallback(
        (value: boolean) => {
            setVisibleState(value);
            localStorage.setItem(storageKey, String(value));
        },
        [storageKey]
    );

    // Is anything actually selected to preview? Computed at render time so
    // the effect below depends on this one boolean instead of on `useTM`
    // wholesale (which changes identity every render).
    const hasContent = hasTaskPreviewContent(useTM);

    // Previous global state, so we can tell an "open" / "switch task"
    // transition from an unrelated re-render.
    const prevRef = useRef({
        visible: useTM.isTaskPreviewVisible,
        openCount: useTM.previewOpenCount ?? 0,
    });

    // Was this surface the active route at the previous effect run? Used to
    // spot the render that brings it to the foreground.
    const wasActiveRef = useRef(isActiveRoute);
    // How many closes the global flag had seen as of the last effect run.
    const seenCloseCountRef = useRef(useTM.previewCloseCount ?? 0);

    useEffect(() => {
        const justActivated = isActiveRoute && !wasActiveRef.current;
        wasActiveRef.current = isActiveRoute;
        const closeCount = useTM.previewCloseCount ?? 0;
        const closedWhileAway = closeCount !== seenCloseCountRef.current;
        seenCloseCountRef.current = closeCount;

        const wasVisible = prevRef.current.visible;
        const prevOpenCount = prevRef.current.openCount;
        prevRef.current = {
            visible: useTM.isTaskPreviewVisible,
            openCount: useTM.previewOpenCount ?? 0,
        };

        if (!useTM.isTaskPreviewVisible) {
            // Global close — every surface follows.
            if (visible) setVisible(false);
            return;
        }

        // Only the foreground page may adopt an open/switch as its own.
        if (!isActiveRoute) return;

        // Coming to the foreground is not an open. Whatever differs from
        // `prevRef` happened while this page was hidden (and, being frozen,
        // not rendering), i.e. on another page. `prevRef` was just brought
        // up to date above; a real open from here on is seen as a change
        // against it. A cross-page "open this thread's task in chat" does not
        // come through here: it sets the visible flag directly
        // (`isThreadTaskVisible` in chatHome).
        if (justActivated) {
            // The same applies to a CLOSE that happened while away. The
            // un-frozen hook saw the global flag drop and lowered `visible`;
            // frozen, it only sees "open" on return, which could be a
            // close-then-reopen on another page. If a close went by, this
            // surface's own preview went with it (a stale persisted `true`
            // from an earlier open here must not resurface for a preview
            // opened elsewhere). A real cross-page open in chat sets the flag
            // itself afterwards (`isThreadTaskVisible`), which wins.
            if (closedWhileAway && visible) setVisible(false);
            return;
        }

        // ...and only when there is something to preview. Opening a thread
        // on the chat page runs `setCurrentPreviewTaskId(-1)` for a message
        // with no task (MessageBubble.replayHandler), which reads here as a
        // task "switch" — from whatever the task page had open to nothing.
        // Adopting that turned the chat surface visible for a preview the
        // user never asked for, and since the selection is empty
        // `TaskPreview` renders null: an empty, unclosable column. A
        // deselection is not an open.
        if (!hasContent) return;

        // An explicit open only: the flag went up, or an open was asked for
        // again while it was up. A new selection on its own is not an open.
        const opened = !wasVisible;
        const askedAgain = (useTM.previewOpenCount ?? 0) !== prevOpenCount;
        if ((opened || askedAgain) && !visible) setVisible(true);
    }, [
        useTM.isTaskPreviewVisible,
        useTM.previewOpenCount,
        useTM.previewCloseCount,
        hasContent,
        isActiveRoute,
        visible,
        setVisible,
    ]);

    return [visible, setVisible];
};
