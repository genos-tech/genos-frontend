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

// The sidebar bucket a personal-backed noteType came from. The inverse
// of `toBackendNoteType`, and the value a tab must carry: once a note is
// open, nothing downstream can tell My / Shared / Team apart, because
// all three are note_type 1.
export const bucketFromNoteType = (noteType: number): "my" | "shared" | "team" => {
    if (noteType === 4) return "shared";
    if (noteType === 8) return "team";
    return "my";
};

// …and back again, for the sidebar highlight + header label.
export const noteTypeFromBucket = (bucket: "my" | "shared" | "team"): number => {
    if (bucket === "shared") return 4;
    if (bucket === "team") return 8;
    return 1;
};

// Which bucket a personal note belongs to, by note id.
//
// Membership in a meta list is the only signal there is. A team note and
// a My Note are the same row on the same endpoint — the folder carries
// the sharing, and neither the note nor a search hit for it says which
// space it came from — so anything that has to NAME the space has to ask
// the lists. Same rule the sidebar applies to favorites and recents and
// the tab-bucket heal in `useNoteManagement`.
//
// Only the non-personal ids are stored, so the map stays the size of the
// exceptions: an id that isn't in it is a My Note.
export const personalNoteScopes = (
    teamNoteMeta: readonly { noteId: number }[],
    sharedNoteMeta: readonly { noteId: number }[]
): Map<number, "shared" | "team"> => {
    const scopes = new Map<number, "shared" | "team">();
    for (const note of sharedNoteMeta) scopes.set(note.noteId, "shared");
    // Team last, so it wins a note that is reachable both ways — the
    // order every other caller resolves the ambiguity in.
    for (const note of teamNoteMeta) scopes.set(note.noteId, "team");
    return scopes;
};
