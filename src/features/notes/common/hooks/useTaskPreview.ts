import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { UserProps } from "../../../../types/admin";
import { TaskProps } from "../../../../types/tasks";
import { keepIfEqual } from "../../../../utils/keepIfEqual";
import { loadSpecificTask } from "../../../tasks/services/loadSpecificTask";

interface UseTaskPreviewProps {
    currentTaskNote: { projectId: number; taskId: number } | null;
    myself: UserProps;
    accessToken: string;
    // A state setter: it takes an updater too, so a reload that returns an equal task can keep the
    // current one (MIP-1677).
    setCurrentPreviewTask: (
        task: TaskProps | undefined | ((prev: TaskProps | undefined) => TaskProps | undefined)
    ) => void;
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
    // Only WHETHER the route is a notes route matters, not which one. Depending on the whole path
    // re-ran the load on every note switch (the path changes, "are we in notes" does not): a second
    // load, answered from the cache, and a second commit of the whole app (MIP-1677).
    const onNotesRoute = pathname.includes("/workspace/notes/");

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
                // A reload of the task that is already shown answers with a new object and the same
                // content (a note switch, a route change): keep what is there, so nothing under it
                // re-renders for it (MIP-1677). Every write here used to be a commit of the whole app.
                setCurrentPreviewTask((prev) => keepIfEqual(prev, loadedTask[0]));
                setCurrentTask((prev) => keepIfEqual(prev, loadedTask[0]));
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
        if (!currentTaskNote || !onNotesRoute) {
            return;
        }
        let cancelled = false;
        void setPreviewTask(currentTaskNote.projectId, currentTaskNote.taskId, () => !cancelled);
        return () => {
            cancelled = true;
        };
    }, [currentTaskNote, onNotesRoute, accessToken]);

    return {
        currentTask,
        setPreviewTask,
    };
};
