import type { ToolResultNoteFolderRef, ToolResultNoteRef } from "../../services/agentApi";

// Agent write tools whose approval changes what the notes sidebar shows: a
// note, a note folder (made, renamed or deleted), or the Favorites list. The tool-result handlers in
// useAgentQA / useSpotlight dispatch the `noteChanged` window event for
// exactly this set, and useNoteManagement re-reads the note meta, the folder
// lists and Favorites on it. Kept here (next to neither hook) so the two
// handlers can't drift apart, the way TASK_WRITE_TOOLS does for tasks.
export const NOTE_SIDEBAR_TOOLS: ReadonlySet<string> = new Set([
    "create_note",
    "update_note",
    "manage_note_folder",
    "favorite_note",
    "delete_note",
    "delete_note_folder",
    // A restore puts an earlier title (and body) back.
    "restore_note_version",
]);

// What `noteChanged` carries. Both refs come from the tool result and are
// undefined on an older backend, which leaves the plain sidebar refetch.
export interface NoteChangedDetail {
    note?: ToolResultNoteRef;
    noteFolder?: ToolResultNoteFolderRef;
}

// The one place a tool result becomes a `noteChanged` event, shared by
// useAgentQA and useSpotlight so the two can't drift. useNoteManagement
// answers it: it re-reads the lists, and for a delete (a `deleted` note ref
// or a folder ref) it also drops the local copies of what the server removed.
export const emitNoteChanged = (
    toolName: string,
    note?: ToolResultNoteRef,
    noteFolder?: ToolResultNoteFolderRef
): void => {
    if (!NOTE_SIDEBAR_TOOLS.has(toolName)) return;
    window.dispatchEvent(
        new CustomEvent<NoteChangedDetail>("noteChanged", { detail: { note, noteFolder } })
    );
};
