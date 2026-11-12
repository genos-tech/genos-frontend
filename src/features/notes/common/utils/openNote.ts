import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { noteTypeFromBucket } from "./noteTypeAlias";

/**
 * Is the note a sidebar row stands for the one that is open? (MIP-1429)
 *
 * The answer comes from the ACTIVE TAB, the one place that knows which note is on screen.
 * Rows used to ask `currentNoteType === their type && their id === current<Kind>Note`. But
 * `currentNoteType` is also set by clicking a section header, so clicking "Task Notes" while a
 * My note was open un-tinted that note's rows (measured in a browser): nothing looked open,
 * though the note was still in the pane.
 *
 * `noteType` is the row's sidebar bucket: 1 my, 4 shared, 8 team (all personal notes), 2 task,
 * 3 chat. A personal note is open "in" the bucket its tab was opened from, so the same note
 * listed under two buckets lights up only where the user opened it.
 */
export const isNoteOpen = (
    activeTab:
        | (Pick<NoteTab, "kind" | "noteId"> & { bucket?: "my" | "shared" | "team" })
        | null
        | undefined,
    noteType: number,
    noteId: number
): boolean => {
    if (!activeTab || activeTab.noteId !== noteId) return false;
    if (activeTab.kind === "my") return noteTypeFromBucket(activeTab.bucket ?? "my") === noteType;
    return (activeTab.kind === "task" ? 2 : 3) === noteType;
};
