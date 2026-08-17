import { useCallback, useEffect, useRef, useState } from "react";

// Title draft for the milestone preview header, which adopts changes made
// somewhere ELSE while it is open.
//
// The problem it solves: renaming a milestone inline in the task table calls
// `useSM.updateExistingMilestone`, which upserts `projectMilestones` — the
// very source `MilestonePreviewInner`'s `milestone` memo reads. But the draft
// was seeded ONLY on milestone identity change, so an open preview kept
// showing the old title until it was re-opened. (The regular-task branch never
// had this gap: the table mirrors a task rename straight into
// `currentPreviewTask`.)
//
// Why it isn't just "re-seed on every change": the draft is a live text input,
// and the preview refreshes for reasons that have nothing to do with the title
// (the initial `refreshMilestone` / `loadSpecificTask` loads resolving after
// mount, the body autosave's deferred `tsUpdatedAt` bump, a status edit). A
// blind re-seed would revert keystrokes typed while any of those were in
// flight. So the draft tracks whether it is dirty and suspends adoption until
// the edit is persisted — the same "don't clobber unsaved work" guard the body
// draft gets from `bodyEdited`, and the reason this is keyed on the title
// value rather than on `tsUpdatedAt`: an edit to any other field then cannot
// touch the input at all.
//
// Dirtiness is a ref, not state: it is only ever READ inside the adopt effect,
// and keeping it out of the dep array is the point — the guard exists to skip
// adoption while an edit is unsaved, not to re-run adoption when it lands.
export const useAdoptableTitleDraft = (
    entityId: number | string | null | undefined,
    externalTitle: string | null | undefined
) => {
    const [titleDraft, setTitleDraftState] = useState(externalTitle ?? "");
    const editedRef = useRef(false);

    // The user typed: the draft is now ahead of the store, so stop adopting.
    const setTitleDraft = useCallback((next: string) => {
        editedRef.current = true;
        setTitleDraftState(next);
    }, []);

    // The store now holds what the input shows, so adoption may resume. Call
    // this only once a save has SUCCEEDED (or when there was nothing to save).
    // Clearing after a failed save would let the next external refresh discard
    // the user's still-unpersisted text.
    const markTitleSaved = useCallback(() => {
        editedRef.current = false;
    }, []);

    // Identity switch — a different entity owns the input now, so its title is
    // authoritative and any dirty flag belonged to the previous one. Keyed on
    // the id alone: `externalTitle` is read at its current value, which is
    // already the new entity's (the caller's lookup memo recomputes in the
    // same render).
    useEffect(() => {
        if (externalTitle == null) return;
        editedRef.current = false;
        setTitleDraftState(externalTitle);
    }, [entityId]);

    // Adopt an external rename, unless a local edit is still unsaved.
    useEffect(() => {
        if (externalTitle == null || editedRef.current) return;
        setTitleDraftState(externalTitle);
    }, [externalTitle]);

    return { titleDraft, setTitleDraft, markTitleSaved };
};
