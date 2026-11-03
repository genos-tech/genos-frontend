// Agent write tools whose approval changes what the notes sidebar shows: a
// note, a note folder, or the Favorites list. The tool-result handlers in
// useAgentQA / useSpotlight dispatch the `noteChanged` window event for
// exactly this set, and useNoteManagement re-reads the note meta, the folder
// lists and Favorites on it. Kept here (next to neither hook) so the two
// handlers can't drift apart, the way TASK_WRITE_TOOLS does for tasks.
export const NOTE_SIDEBAR_TOOLS: ReadonlySet<string> = new Set([
    "create_note",
    "update_note",
    "manage_note_folder",
    "favorite_note",
]);
