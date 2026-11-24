import { useState } from "react";

/**
 * MIP-2370: one pane for "create" and then "the thing just created".
 *
 * The create form and the task/milestone preview used to be two different
 * panes (desktop: two resizable `Panel`s; mobile: two full-screen overlays).
 * Submitting closed the form pane and, a beat later, opened the preview pane:
 * the pane vanished and came back.
 *
 * When the form opens with NO preview on screen, it is "solo": the form takes
 * the preview's slot, and when the create finishes the same slot swaps its
 * content to the new item's preview, so the container never unmounts. When a
 * preview was already open (a sub-task created from it), the form keeps its
 * own pane beside it as before, and the existing preview just switches item.
 *
 * `solo` is decided once, on the rising edge of `creating`, and held until
 * `creating` drops. That matters: the submit handlers raise the preview flags
 * a moment BEFORE they lower the creating flag, and re-reading "is a preview
 * shown" in that window would split the pane in two.
 */
export const useSoloCreatePane = (creating: boolean, previewShown: boolean): boolean => {
    const [prevCreating, setPrevCreating] = useState(false);
    const [solo, setSolo] = useState(false);
    // Adjusting state while rendering (React's documented "derive from prop
    // change" pattern): React re-renders at once, so no frame paints the stale value.
    if (creating !== prevCreating) {
        setPrevCreating(creating);
        setSolo(creating && !previewShown);
    }
    return creating && (creating !== prevCreating ? !previewShown : solo);
};

/**
 * MIP-2373: keep the preview slot mounted between a solo form closing and the new
 * item's preview opening.
 *
 * The milestone submit raises the preview flag and lowers the creating flag in ONE
 * commit, while the chat surface flag (and, on phone, the loaded task) only follow a
 * commit later, so for a moment nothing says "show a preview" and the slot would unmount
 * and come back. The hold is armed when a solo form opens, and applies only if the
 * preview was REQUESTED since then (`openCount` moved), so cancelling the form with a
 * preview request left over from before does not open one. It lets go as soon as the
 * preview is really shown, or the request goes away.
 *
 * `requested`: the global flag is up and something is selected. `shown`: the surface
 * really shows the preview.
 */
export const useHoldPreviewAfterSolo = (
    solo: boolean,
    openCount: number,
    requested: boolean,
    shown: boolean
): boolean => {
    const [armedAt, setArmedAt] = useState<number | null>(null);
    if (solo && armedAt === null) setArmedAt(openCount);
    // Also disarm when the form closed and the open count never moved since it armed:
    // nothing was requested during the form (a cancel), so a LATER open elsewhere must
    // not be read as this form's request.
    if (!solo && armedAt !== null && (shown || !requested || openCount === armedAt)) {
        setArmedAt(null);
    }
    return !solo && armedAt !== null && requested && !shown && openCount !== armedAt;
};
