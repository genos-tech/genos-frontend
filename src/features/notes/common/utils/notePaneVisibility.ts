// Should the task/chat page render its note pane right now?
//
// Those two pages host the note editor as a sibling resizable panel, and
// that panel carries NO chrome of its own: the close button lives inside
// the note header, which the note component renders — and both note
// components bail out when there is no note to show (`ChatNoteMain`
// returns null on a null note; `TaskHomeLayout` gates each
// `*NoteMain` on the matching `current*Note`). So "pane visible, no note
// open" paints an empty half-page panel that the user cannot dismiss:
// the close button they would use is inside the thing that didn't render.
// Closing every note tab is the easy way to get there.
//
// The notes page has no equivalent problem — it swaps in its default
// view when the last tab closes.
//
// So pane visibility is DERIVED rather than tracked: the user's "show me
// the notes pane" intent AND something to actually show. The intent flag
// (`isTaskNoteVisible` / `isChatNoteVisibleInChat`) stays exactly as it
// was — deriving instead of clearing it on close keeps re-opening a note
// working through the same flag, and avoids a write that would have to
// race every asynchronous open path.
//
// `isOpening` keeps the pane up while an open is still in flight, so it
// doesn't blink out between the click and the note landing. Only the
// chat page has such a signal (`chatPanelApi.isLoading`); the task page
// opens its tab synchronously in the click handler, and its one async
// path (creating a brand-new note) simply mounts the pane a beat later
// instead of showing an empty frame while the POST is out.
export const isNotePaneVisible = ({
    isVisible,
    hasOpenNote,
    isOpening = false,
}: {
    isVisible: boolean;
    hasOpenNote: boolean;
    isOpening?: boolean;
}): boolean => isVisible && (hasOpenNote || isOpening);
