import { useEffect, useRef } from "react";

import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";

type PreviewEditMirrorArgs = {
    /** TaskPreview's own working copy of the open task. */
    working: TaskProps;
    /** The host's preview slot (`useTM.currentPreviewTask`, or a modal's own). */
    preview: TaskProps | undefined;
    myself: UserProps;
    /** Writes the host's preview slot. */
    setPreview: (task: TaskProps) => void;
    /** Pushes an edited task onto its table row (`useTM.syncPreviewEdit`). */
    syncRow: (task: TaskProps) => void;
    setAssignee: (assignee: UserProps | null) => void;
    setReporter: (reporter: UserProps) => void;
};

/**
 * Hands TaskPreview's working copy to the rest of the app whenever it changes.
 *
 * - An EDIT (a working copy that is not the host's preview object yet) goes to
 *   the host's preview slot and onto the task's table row, once per edit.
 * - A LOAD or a self-echo (the working copy IS the host's preview object)
 *   pushes nothing, so opening a task writes nothing to the table. The empty
 *   working copy a preview mounts with has no id and is kept off the table.
 * - The assignee / reporter chips keep their own state, so they are refreshed
 *   from every working copy that arrives, loads included.
 *
 * This replaces the `isTaskUpdated` flag loop (MIP-968): the flag made every
 * open cost two extra commits and a `/task/meta/` request, and swallowed an
 * edit that landed while it was still set. There is no flag to be set now, so
 * back-to-back edits all arrive.
 *
 * The effect keys on the working copy alone, as the loop it replaces did; the
 * rest is read at that moment through a ref.
 */
export const usePreviewEditMirror = (args: PreviewEditMirrorArgs): void => {
    const latest = useRef(args);
    latest.current = args;

    useEffect(() => {
        const { working, preview, myself, setPreview, syncRow, setAssignee, setReporter } =
            latest.current;
        if (working !== preview) {
            setPreview(working);
            if (working?.id != null) syncRow(working);
        }
        setAssignee(working?.assignee ?? null);
        setReporter(working?.reporter || myself);
    }, [args.working]);
};
