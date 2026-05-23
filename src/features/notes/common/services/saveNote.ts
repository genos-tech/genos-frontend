import { Socket } from "socket.io-client";

import { UserProps } from "../../../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../../../types/notes";
import { sendUpdatedChatNote } from "../../chat-notes/services/sendUpdatedChatNote";
import { sendUpdatedMyNote } from "../../my-notes/services/sendUpdatedMyNote";
import { sendUpdatedTaskNote } from "../../task-notes/services/sendUpdatedTaskNote";
import { addNote } from "./addNote";

export type EditableNote = MyNoteProps | TaskNoteProps | ChatNoteProps;

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
        await addNote(1, note);
        return;
    }
    if (note.noteType === 2) {
        await sendUpdatedTaskNote(myself, note as TaskNoteProps, accessToken, socket);
        await addNote(2, note);
        return;
    }
    if (note.noteType === 3) {
        await sendUpdatedChatNote(myself, note as ChatNoteProps, accessToken, socket);
        await addNote(3, note);
    }
};
