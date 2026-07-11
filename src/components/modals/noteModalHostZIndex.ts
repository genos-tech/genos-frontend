import { createContext, useContext } from "react";

// Set by ModalNoteView to the host UrlLinkModal's z-index. Joy Modals
// opened from inside a modal-hosted note preview — Move-to-folder and the
// Delete dialogs (hardcoded z:10010), plus Share / Ask / version-History
// (Joy default ~1300) — all sit BELOW the preview (≥10020), so they open
// behind it. A modal that reads this context lifts itself above the
// preview when the value is non-null; undefined on page surfaces (no
// provider) → the modal keeps its normal stacking.
//
// Context rather than a prop because these modals are scattered across
// the note headers, NoteHistoryChip, and the *NoteMain delete sites —
// threading a prop to each would touch a dozen intermediate components.
// React context is delivered by tree position, not DOM position, so it
// still reaches a Joy <Modal> even though the modal portals to
// document.body.
const NoteModalHostZIndexContext = createContext<number | undefined>(undefined);

export const NoteModalHostZIndexProvider = NoteModalHostZIndexContext.Provider;

export const useNoteModalHostZIndex = (): number | undefined =>
    useContext(NoteModalHostZIndexContext);

// Lift over the host so the child modal clears the preview dialog and the
// ⋮ dropdown (which sits at host + 1). A small, predictable margin.
export const NOTE_MODAL_CHILD_ZINDEX_OFFSET = 2;

// sx overrides that stack a child Joy modal above a modal-hosted note
// preview. Spreads into the modal's existing `sx`. Empty on page surfaces
// (no host) so the modal keeps its normal z. When hosted it also
// re-stamps `--unstable_popup-zIndex` for any Joy listbox popups inside
// the child modal (assignee/member Selects) — Joy otherwise pins those to
// ~1301, i.e. behind the now-raised modal. Mirrors UrlLinkModal's own
// listbox re-stamp.
export const noteModalChildStackSx = (hostZIndex: number | undefined): Record<string, unknown> => {
    if (hostZIndex == null) return {};
    const z = hostZIndex + NOTE_MODAL_CHILD_ZINDEX_OFFSET;
    return {
        zIndex: z,
        "--unstable_popup-zIndex": z + 10,
        '& ~ [role="listbox"]': { "--unstable_popup-zIndex": z + 10 },
    };
};
