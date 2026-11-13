import { useEffect } from "react";

/**
 * "These notes are gone" (MIP-1435).
 *
 * The notes page owns the lists a note shows up in (`useNoteManagement`), but a few readers keep
 * their own copy of a note's id: the history list (localStorage) and the unread-mention list
 * (derived from the activity feed). `useNoteManagement` announces a delete here, once, whatever
 * deleted it (a sidebar menu, a note header, a folder, an approved agent tool), and they react.
 * The same shape as the `noteChanged` window event.
 *
 * `noteType` is the BACKEND type (1 personal, 2 task, 3 chat): a My, Shared or Team note is 1.
 */
export const NOTE_DELETED_EVENT = "noteDeleted";

export type NoteDeletedDetail = { noteType: 1 | 2 | 3; noteIds: number[] };

export const emitNoteDeleted = (detail: NoteDeletedDetail): void => {
    if (typeof window === "undefined" || detail.noteIds.length === 0) return;
    window.dispatchEvent(new CustomEvent<NoteDeletedDetail>(NOTE_DELETED_EVENT, { detail }));
};

/** Calls `callback` for every delete announced while the component is mounted. */
export const useNoteDeleted = (callback: (detail: NoteDeletedDetail) => void): void => {
    useEffect(() => {
        const handler = (event: Event) =>
            callback((event as CustomEvent<NoteDeletedDetail>).detail);
        window.addEventListener(NOTE_DELETED_EVENT, handler);
        return () => window.removeEventListener(NOTE_DELETED_EVENT, handler);
    }, [callback]);
};
