// "Re-seed your editor from the stored body" signals, one per note (MIP-2462).
//
// A version restore, and an agent write that could not reach the collab document, make the mounted
// editors OF THAT NOTE replace their document with the body just read. One counter for the whole app
// did that to every mounted editor, each with its own cached body, over whatever was live in it.

import { toBackendNoteType } from "./noteTypeAlias";

export type NoteResyncCounts = Readonly<Record<string, number>>;

// By backend type: the Shared (4) and Team (8) aliases are the same note as personal (1).
const keyOf = (noteType: number, noteId: number) => `${toBackendNoteType(noteType)}-${noteId}`;

export const noteResyncSignal = (
    counts: NoteResyncCounts,
    note: { noteType: number; noteId: number } | null | undefined
): number => (note ? (counts[keyOf(note.noteType, note.noteId)] ?? 0) : 0);

export const bumpNoteResync = (
    counts: NoteResyncCounts,
    noteType: number,
    noteId: number
): NoteResyncCounts => {
    const key = keyOf(noteType, noteId);
    return { ...counts, [key]: (counts[key] ?? 0) + 1 };
};
