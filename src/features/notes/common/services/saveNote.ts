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
export const saveNote = async (
    note: EditableNote,
    myself: UserProps,
    accessToken: string | null
): Promise<void> => {
    if (note.noteType === 1) {
        await sendUpdatedMyNote(myself, note as MyNoteProps, accessToken);
        await addNote(1, note);
        return;
    }
    if (note.noteType === 2) {
        await sendUpdatedTaskNote(myself, note as TaskNoteProps, accessToken);
        await addNote(2, note);
        return;
    }
    if (note.noteType === 3) {
        await sendUpdatedChatNote(myself, note as ChatNoteProps, accessToken);
        await addNote(3, note);
    }
};
