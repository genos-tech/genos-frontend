import { createContext, useContext } from "react";

// The layer of the host UrlLinkModal, for what opens from inside a modal-hosted preview
// (the note dialogs, the image lightbox). They sit BELOW the preview (>= 10020) at their
// own layer, so they open behind it. A dialog that reads this context passes it to
// `ModalFrame`'s `hostZIndex` and lifts itself above the preview; undefined on page
// surfaces (no provider) -> it keeps its normal stacking.
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
