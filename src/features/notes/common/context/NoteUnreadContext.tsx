import { createContext, useContext } from "react";

/** A note that currently has unread @mentions, for the sidebar's
 *  "Unread" section. */
export interface UnreadNote {
    noteType: number;
    noteId: number;
    title: string;
}

/**
 * Unread @mention state for notes, mirrored from the activity feed
 * (`useCM.activityMessages` rows with surface chatType 6/7/8 + isRead=false).
 *
 * Provided once at the notes-home level and consumed by the note list
 * renderers (tree / recents / favorites / the Unread section) so the
 * recursive tree doesn't have to thread unread props through every level.
 */
export interface NoteUnreadValue {
    /** True when (noteType, noteId) has at least one unread @mention. */
    isUnread: (noteType: number, noteId: number) => boolean;
    /** Mark every unread @mention for a note read — call on open. */
    markRead: (noteType: number, noteId: number) => void;
    /** Distinct notes with unread mentions, for the "Unread" section. */
    unreadNotes: UnreadNote[];
}

const NOOP: NoteUnreadValue = {
    isUnread: () => false,
    markRead: () => {},
    unreadNotes: [],
};

const NoteUnreadContext = createContext<NoteUnreadValue>(NOOP);

export const NoteUnreadProvider = NoteUnreadContext.Provider;

/** Returns the unread state; a no-op default when no provider is mounted
 *  (so renderers used outside notes-home don't crash). */
export const useNoteUnread = (): NoteUnreadValue => useContext(NoteUnreadContext);
