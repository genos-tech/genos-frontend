import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { UserProps } from "../../../../types/admin";
import { TaskProps } from "../../../../types/tasks";
import { loadSpecificTask } from "../../../tasks/services/loadSpecificTask";

interface UseTaskPreviewProps {
    currentTaskNote: { projectId: number; taskId: number } | null;
    myself: UserProps;
    accessToken: string;
    setCurrentPreviewTask: (task: TaskProps) => void;
}

export const useTaskPreview = ({
    currentTaskNote,
    myself,
    accessToken,
    setCurrentPreviewTask,
}: UseTaskPreviewProps) => {
    const [currentTask, setCurrentTask] = useState<TaskProps | undefined>();
    // Reactive router path — used as an effect dependency below so the
    // preview load re-runs once the route settles (see the effect note).
    const { pathname } = useLocation();

    const setPreviewTask = async (
        projectId: number,
        taskId: number,
        // Guard checked AFTER the await so a superseded load (the user
        // switched to a newer note while this one was in flight) can't
        // overwrite the newer note's task. Defaults to a no-op for any
        // imperative caller that doesn't need cancellation.
        shouldApply: () => boolean = () => true
    ) => {
        try {
            const loadedTask: TaskProps[] = await loadSpecificTask(
                myself,
                projectId,
                taskId,
                accessToken
            );
            if (!shouldApply()) return;
            if (loadedTask.length === 1) {
                setCurrentPreviewTask(loadedTask[0]);
                setCurrentTask(loadedTask[0]);
            }
        } catch (error) {
            if (shouldApply()) console.error("Failed to load task:", error);
        }
    };

    useEffect(() => {
        // Loads the task that backs the note header's project avatar +
        // task pill. Scoped to the notes section so the task page and the
        // chat note panel (which own their own task state) don't trigger
        // it.
        //
        // We gate on the REACTIVE router `pathname` (and depend on it)
        // rather than a one-shot `window.location.pathname` read: on the
        // FIRST task note opened, this effect fires the instant
        // `currentTaskNote` is set — which can be a tick BEFORE the route
        // has settled to `/workspace/notes/...`. With the raw read the
        // gate was false, the load was skipped, and because the effect
        // only depended on `currentTaskNote` it never retried — so the
        // pill stayed hidden until a *different* note was clicked. Listing
        // `pathname` re-runs the load once the route catches up;
        // `accessToken` does the same if the JWT resolves late.
        if (!currentTaskNote || !pathname.includes("/workspace/notes/")) {
            return;
        }
        let cancelled = false;
        void setPreviewTask(currentTaskNote.projectId, currentTaskNote.taskId, () => !cancelled);
        return () => {
            cancelled = true;
        };
    }, [currentTaskNote, pathname, accessToken]);

    return {
        currentTask,
        setPreviewTask,
    };
};
