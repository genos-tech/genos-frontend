import { ReactNode, useLayoutEffect, useRef } from "react";
import { Box } from "@mui/joy";

import { TaskPreviewPaneState } from "../../../utils/taskPreviewPaneState";
import { TaskPaneLoading } from "./TaskPaneLoading";

// ~ a few frames. Longer than a cache-hit swap (lands within a frame), short
// enough that a genuinely slow load shows feedback before it feels stuck.
export const SWITCH_LOADER_DELAY_MS = 150;

type TaskPreviewSwitchGateProps = {
    state: TaskPreviewPaneState;
    /** Task-page mode. Keep the OUTGOING task mounted (hidden) while its
     *  replacement loads, and fade the loader in after a short delay.
     *  Without it (chat) the outgoing task is unmounted and the loader is
     *  immediate — the original guarded behaviour. */
    holdOutgoing: boolean;
    isDark: boolean;
    loadingLabel: string;
    /** The task view. A function so it is only built when it will mount —
     *  it reads the working copy, which does not exist in "loading". */
    children: () => ReactNode;
    /** The task view has just been taken off the screen. Runs while the editor in it can still
     *  hand over the text it has not synced (MIP-2455). */
    onTaskViewRemoved?: () => void;
};

/**
 * Chooses between the task view and the loading pane (see
 * `getTaskPreviewPaneState`).
 *
 * Why `holdOutgoing` hides instead of unmounting: the outgoing task's
 * unsaved body lives in the mounted editor (its debounced sync is cancelled
 * on unmount) and `TaskPreview`'s switch effect reads that live state when
 * the next task lands. Hiding it with `display: none` keeps every one of
 * those paths exactly as they were when the stale task simply stayed on
 * screen — the loader just covers it. It also means the heavy task subtree is
 * updated in place on the swap rather than torn down and rebuilt.
 *
 * Slot positions are fixed (task view first, loader second) so flipping
 * between states never remounts the task view.
 */
export const TaskPreviewSwitchGate = ({
    state,
    holdOutgoing,
    isDark,
    loadingLabel,
    children,
    onTaskViewRemoved,
}: TaskPreviewSwitchGateProps) => {
    const keepMounted = holdOutgoing && (state === "content" || state === "switching");
    const taskView =
        state === "content" || keepMounted ? (
            holdOutgoing ? (
                // `contents` is layout-neutral: the task view stays a direct
                // flex child of the host panel, exactly as without the wrapper.
                <Box sx={{ display: state === "content" ? "contents" : "none" }}>{children()}</Box>
            ) : (
                children()
            )
        ) : null;

    // The gate itself can go with the view in it (the milestone preview takes the pane).
    const removedRef = useRef(onTaskViewRemoved);
    removedRef.current = onTaskViewRemoved;
    useLayoutEffect(() => () => removedRef.current?.(), []);

    // A LAYOUT effect: the removed editor's own cleanup has not run yet.
    const removed = taskView === null;
    useLayoutEffect(() => {
        if (removed) onTaskViewRemoved?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [removed]);

    return (
        <>
            {taskView}
            {state === "loading" || state === "switching" ? (
                <TaskPaneLoading
                    isDark={isDark}
                    label={loadingLabel}
                    fadeInDelayMs={
                        holdOutgoing && state === "switching" ? SWITCH_LOADER_DELAY_MS : undefined
                    }
                />
            ) : null}
        </>
    );
};
