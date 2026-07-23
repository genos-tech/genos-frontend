import { useCallback, useEffect, useRef, useState } from "react";

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
 * The Homes are keep-alive — they stay mounted while hidden — so a
 * backgrounded Home's effects still observe the global flag flipping.
 * That is exactly why the observation below is gated on `isActiveRoute`:
 * only the page the user is actually looking at may adopt an "opened"
 * transition as its own. A preview opened on the task page therefore
 * never marks the chat surface visible.
 *
 * Closing is intentionally NOT scoped: when the global flag goes false
 * the preview really was closed, so every surface follows it down.
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

    // Previous global state, so we can tell an "open" / "switch task"
    // transition from an unrelated re-render.
    const prevRef = useRef({
        visible: useTM.isTaskPreviewVisible,
        taskId: useTM.currentPreviewTaskId,
    });

    useEffect(() => {
        const wasVisible = prevRef.current.visible;
        const prevTaskId = prevRef.current.taskId;
        prevRef.current = {
            visible: useTM.isTaskPreviewVisible,
            taskId: useTM.currentPreviewTaskId,
        };

        if (!useTM.isTaskPreviewVisible) {
            // Global close — every surface follows.
            if (visible) setVisible(false);
            return;
        }

        // Only the foreground page may adopt an open/switch as its own.
        if (!isActiveRoute) return;

        const opened = !wasVisible;
        const switched = prevTaskId !== useTM.currentPreviewTaskId;
        if ((opened || switched) && !visible) setVisible(true);
    }, [
        useTM.isTaskPreviewVisible,
        useTM.currentPreviewTaskId,
        isActiveRoute,
        visible,
        setVisible,
    ]);

    return [visible, setVisible];
};
