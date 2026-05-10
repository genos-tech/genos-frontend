import { useNoteEditorCore } from "../../features/notes/common/hooks/useNoteEditorCore";
import {
    NoteEditorActions,
    NoteEditorProps,
    NoteEditorState,
} from "../../features/notes/common/types/noteEditor";
import { MyNoteProps } from "../../types/notes";

interface UseNoteEditorReturn extends NoteEditorState, NoteEditorActions {}

/**
 * Personal-note editor hook. Thin wrapper around `useNoteEditorCore` that
 * preserves the legacy field names (`currentMyNoteTitle` / `setCurrentMyNoteTitle`)
 * expected by `MyNoteMain`.
 */
export const useNoteEditor = ({
    currentMyNote,
    myself,
    accessToken,
    onNoteUpdate,
}: NoteEditorProps): UseNoteEditorReturn => {
    const core = useNoteEditorCore<MyNoteProps>({
        currentNote: currentMyNote,
        myself,
        accessToken,
        onNoteUpdate,
    });

    return {
        currentMyNoteTitle: core.title,
        setCurrentMyNoteTitle: core.setTitle,
        titleInputRef: core.titleInputRef,
        handleTitleChange: core.handleTitleChange,
        handleTitleBlur: core.handleTitleBlur,
        body: core.body,
        setBody: core.setBody,
        handleBodyChange: core.handleBodyChange,
        noteBodyEdited: core.noteBodyEdited,
        noteBodySaved: core.noteBodySaved,
        setNoteBodyEdited: core.setNoteBodyEdited,
        setNoteBodySaved: core.setNoteBodySaved,
        updateNote: core.updateNote,
    };
};
