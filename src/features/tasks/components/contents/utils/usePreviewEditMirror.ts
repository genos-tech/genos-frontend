import { useEffect, useRef } from "react";

import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { keepIfEqual } from "../../../../../utils/keepIfEqual";

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

/** Is `working` an edit to hand over: a task (it has an id), not already the
 *  host's object, and the slot shows the same task or no task at all. */
const isEditOfShownTask = (working: TaskProps, preview: TaskProps | undefined): boolean =>
    working?.id != null &&
    working !== preview &&
    (preview?.id == null || String(preview.id) === String(working.id));

/** Does `working` say exactly what the slot's task says (another object, same content)?
 *
 *  That is the loop of MIP-1439. TaskPreview pulls the host's task into its working
 *  copy whenever the slot changes (its sync effect), and this hook pushes the working
 *  copy into the slot whenever it changes. When the slot and the working copy hold two
 *  objects with the SAME content (a load and a copy of it, say, as the comments of an
 *  open land together with the task), both effects fire in one commit and each takes
 *  the other's object: the slot gets the working copy, the working copy gets the
 *  slot's, so next commit they have swapped, and they swap again, until React throws
 *  "Maximum update depth exceeded" and the Tasks page shows "Something went wrong".
 *  Identity is not an edit: a copy that says what the slot already says is not handed
 *  to the slot. (The ROW still follows it: see the effect.) */
const saysWhatTheSlotSays = (working: TaskProps, preview: TaskProps | undefined): boolean =>
    preview != null && keepIfEqual(preview, working) === preview;

/**
 * Hands TaskPreview's working copy to the rest of the app whenever it changes.
 *
 * - An EDIT (a working copy that is not the host's preview object yet, of the
 *   task the host's slot shows or into a slot that holds no task) goes to the
 *   host's preview slot and onto the task's table row, once per edit. A copy
 *   with exactly the slot's content goes to the row only (MIP-1439: handing it
 *   to the slot starts a swap loop).
 * - A LOAD or a self-echo (the working copy IS the host's preview object)
 *   pushes nothing, so opening a task writes nothing to the table.
 * - A copy with no id (the empty one a preview mounts with) or of ANOTHER task
 *   than the slot's pushes nothing. More than one TaskPreview can be mounted on
 *   one slot (the Tasks page and another Home's panel), and each handed its copy
 *   over because it differed from the other's, so they overwrote each other back
 *   and forth: dozens of whole-pane renders per click. Such a copy is a preview
 *   that has not caught up with the slot yet; TaskPreview's sync effect pulls the
 *   slot's task into it.
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
        if (isEditOfShownTask(working, preview)) {
            // Not to the slot when it already says the same (MIP-1439), but to the row
            // either way: a refused save puts the stored task back into the working copy
            // AND the slot as two separate objects of one content, and the row, which
            // showed the edit, can only follow through here.
            if (!saysWhatTheSlotSays(working, preview)) setPreview(working);
            syncRow(working);
        }
        setAssignee(working?.assignee ?? null);
        setReporter(working?.reporter || myself);
    }, [args.working]);
};
