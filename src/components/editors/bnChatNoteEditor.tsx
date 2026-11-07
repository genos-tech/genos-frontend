import { ChatNoteProps } from "../../types/notes";
import { GenosNoteEditor, GenosNoteEditorProps } from "./genos/GenosNoteEditor";

type BnChatNoteEditorProps = Omit<GenosNoteEditorProps, "note"> & {
    currentChatNote: ChatNoteProps;
};

/**
 * A chat note. The editor is `GenosNoteEditor`; this is only what is particular to the kind.
 */
export const BnChatNoteEditor = ({ currentChatNote, ...rest }: BnChatNoteEditorProps) => (
    <GenosNoteEditor
        {...rest}
        note={{
            noteId: currentChatNote.noteId,
            title: currentChatNote.title,
            documentPrefix: "chat-note",
            uploadPath: "/note/chat/attachment/",
            uploadFields: {
                chat_type: String(currentChatNote.chatType),
                chat_id: String(currentChatNote.chatId),
                is_thread: String(currentChatNote.isThread),
                thread_id: String(currentChatNote.threadId),
            },
            commentHost: {
                surfaceType: 8,
                chatType: currentChatNote.chatType,
                chatId: currentChatNote.chatId,
                threadId: currentChatNote.threadId,
            },
            imageFilenameStem: "chat-note-image",
        }}
    />
);
