import { getCachedNote, upsertNoteCache } from "../../../hooks/notes/useNoteData";
import type { MyNoteProps } from "../../../types/notes";

/**
 * After the details were saved with a new title, write that title into the note cache, so the
 * editor's next body save carries it (the server renames the note with the skill, and a save
 * from the old cached title would undo that).
 */
export const syncSkillNoteTitle = (noteId: number, title: string): void => {
    const cached = getCachedNote<MyNoteProps>("my", noteId);
    if (cached && cached.title !== title) upsertNoteCache({ ...cached, title });
};
