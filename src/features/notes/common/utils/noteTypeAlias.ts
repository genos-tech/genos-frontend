// `noteType` is overloaded in the sidebar. Codes 0 and 5-7 are pseudo
// types that only drive section highlighting (Home / Favorites /
// Recents / Unread) and never reach the backend. Codes 4 and 8 are
// UI-ONLY ALIASES of 1: both Shared Notes and Team Notes are personal
// notes served by the `/note/personal/…` endpoints, and differ only in
// which sidebar bucket they appear in.
//
// The backend knows exactly three: 1 personal, 2 task, 3 chat.
//
// Every call that crosses into the backend, IndexedDB, or the Yjs room
// name must translate first. Before this helper the 4→1 mapping was
// open-coded as a ternary at each site, which meant adding a second
// alias (8) silently sent an unknown type on any site that wasn't
// updated — the failure being a 404 or a silently empty response rather
// than a type error.
export type BackendNoteType = 1 | 2 | 3;

const PERSONAL_ALIASES = new Set([1, 4, 8]);

export const toBackendNoteType = (noteType: number): BackendNoteType => {
    if (PERSONAL_ALIASES.has(noteType)) return 1;
    if (noteType === 2) return 2;
    if (noteType === 3) return 3;
    // Pseudo types (0, 5-7) have no backend note behind them; treat them
    // as personal rather than passing an unknown code downstream.
    return 1;
};

// True for the sidebar buckets backed by personal notes — the ones whose
// rows open through MyNoteMain / MyNoteEditorPanel and the `my-note:`
// Yjs room.
export const isPersonalNoteBucket = (noteType: number): boolean => PERSONAL_ALIASES.has(noteType);
