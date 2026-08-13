import { Socket } from "socket.io-client";

import { upsertNoteCache } from "../../../../hooks/notes/useNoteData";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../../../types/notes";
import { sendUpdatedChatNote } from "../../chat-notes/services/sendUpdatedChatNote";
import { sendUpdatedMyNote } from "../../my-notes/services/sendUpdatedMyNote";
import { sendUpdatedTaskNote } from "../../task-notes/services/sendUpdatedTaskNote";
import { addNote } from "./addNote";

export type EditableNote = MyNoteProps | TaskNoteProps | ChatNoteProps;

// Write the just-persisted note into the two client-side tiers: the
// in-memory note cache first, then IndexedDB.
//
// The in-memory write belongs HERE, not only in each editor's
// `onNoteUpdate` callback. A note can be open in two mounted panels at
// once (the task/chat-page inline editor plus the notes-home LRU pool
// panel, which stays mounted because NoteHome is kept-alive), and the
// cache is what keeps the other panel's title current. `addNote` is a
// worker round-trip that can reject; when it did, the rejection
// propagated out of `saveNote` and skipped the caller's `onNoteUpdate`
// entirely — so the backend had the rename while every in-memory reader
// still held the old title, and that panel's next autosave PUT the old
// title back over it.
//
// IndexedDB is likewise a cache, so failing to update it must not be
// reported to the caller as a failed save.
const cacheThrough = async (noteType: 1 | 2 | 3, note: EditableNote): Promise<void> => {
    upsertNoteCache(note);
    try {
        await addNote(noteType, note);
    } catch (error) {
        console.error("Note saved, but writing it to IndexedDB failed:", error);
    }
};

// Single source of truth for "persist note edits": pushes the new note to the
// backend and writes it through to IndexedDB. Replaces the per-noteType save
// dispatch that used to be copy-pasted across `useNoteEditor`,
// `useChatNoteEditor`, and `useNoteAutoSave`.
//
// `socket` is threaded through so the senders can emit the `note_mention`
// event when the PUT response reports a mention delta. Passing `null` is
// supported (no socket → no notification, save still succeeds).
export const saveNote = async (
    note: EditableNote,
    myself: UserProps,
    accessToken: string | null,
    socket: Socket | null
): Promise<void> => {
    if (note.noteType === 1) {
        await sendUpdatedMyNote(myself, note as MyNoteProps, accessToken, socket);
        await cacheThrough(1, note);
        return;
    }
    if (note.noteType === 2) {
        await sendUpdatedTaskNote(myself, note as TaskNoteProps, accessToken, socket);
        await cacheThrough(2, note);
        return;
    }
    if (note.noteType === 3) {
        await sendUpdatedChatNote(myself, note as ChatNoteProps, accessToken, socket);
        await cacheThrough(3, note);
    }
};
