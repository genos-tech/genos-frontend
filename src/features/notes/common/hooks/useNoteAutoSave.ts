import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { useNoteEditorCore } from "./useNoteEditorCore";

interface UseNoteAutoSaveProps {
    currentTaskNote: TaskNoteProps | null;
    myself: UserProps;
    accessToken: string;
    onNoteUpdate?: (updatedNote: TaskNoteProps) => void;
    resyncSignal?: number | string;
}

interface UseNoteAutoSaveReturn {
    currentTaskNoteTitle: string;
    setCurrentTaskNoteTitle: (title: string) => void;
    body: PartialBlock[] | undefined;
    setBody: (body: PartialBlock[]) => void;
    noteBodyEdited: boolean;
    noteBodySaved: boolean;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    handleTitleChange: (value: string) => void;
    handleTitleBlur: () => void;
    handleBodyChange: (newBody: PartialBlock[]) => void;
    updateNote: () => Promise<void>;
}

/**
 * Task-note editor hook. Thin wrapper around `useNoteEditorCore` that
 * preserves the legacy field names (`currentTaskNoteTitle`) expected by
 * `TaskNoteMain` and `TaskNoteTabs`.
 *
 * The `body` and `currentTaskNoteTitle` state used to live in `TaskNoteMain`
 * itself, with this hook only owning the autosave timer. That split was the
 * source of the "title of note A is overwritten by the title of note C after
 * switching tabs between huge notes" race — see `useNoteEditorCore` for the
 * fix.
 */
export const useNoteAutoSave = ({
    currentTaskNote,
    myself,
    accessToken,
    onNoteUpdate,
    resyncSignal,
}: UseNoteAutoSaveProps): UseNoteAutoSaveReturn => {
    const core = useNoteEditorCore<TaskNoteProps>({
        currentNote: currentTaskNote,
        myself,
        accessToken,
        onNoteUpdate,
        resyncSignal,
    });

    return {
        currentTaskNoteTitle: core.title,
        setCurrentTaskNoteTitle: core.setTitle,
        body: core.body,
        setBody: core.setBody,
        noteBodyEdited: core.noteBodyEdited,
        noteBodySaved: core.noteBodySaved,
        setNoteBodyEdited: core.setNoteBodyEdited,
        setNoteBodySaved: core.setNoteBodySaved,
        titleInputRef: core.titleInputRef,
        handleTitleChange: core.handleTitleChange,
        handleTitleBlur: core.handleTitleBlur,
        handleBodyChange: core.handleBodyChange,
        updateNote: core.updateNote,
    };
};
