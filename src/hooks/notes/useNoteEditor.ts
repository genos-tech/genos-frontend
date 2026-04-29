import { useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { addNote } from "../../features/notes/common/services/addNote";
import {
    NoteEditorActions,
    NoteEditorProps,
    NoteEditorState,
} from "../../features/notes/common/types/noteEditor";
import { sendUpdatedMyNote } from "../../features/notes/my-notes/services/sendUpdatedMyNote";
import { UserProps } from "../../types/admin";
import { MyNoteProps } from "../../types/notes";

interface UseNoteEditorReturn extends NoteEditorState, NoteEditorActions {}

// Debounce delay between the user's last body edit and the auto-save firing.
const AUTO_SAVE_DELAY_MS = 3000;

/**
 * Custom hook for managing note editing functionality
 * Handles title editing, body editing, auto-save, and note updates
 *
 * @param props - Configuration object for the note editor
 * @returns Object containing state and actions for note editing
 */
export const useNoteEditor = ({
    currentMyNote,
    myself,
    accessToken,
    onNoteUpdate,
}: NoteEditorProps): UseNoteEditorReturn => {
    const [currentMyNoteTitle, setCurrentMyNoteTitle] = useState<string>(
        currentMyNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // Update note title when current note changes
    useEffect(() => {
        if (currentMyNote) {
            setCurrentMyNoteTitle(currentMyNote.title);
            setBody(currentMyNote.body);
        }
    }, [currentMyNote]);

    const updateNote = useCallback(async () => {
        if (!currentMyNote || !accessToken) return;

        let newNoteTitle = currentMyNoteTitle;

        // If the note title is empty, use the note original title
        if (currentMyNoteTitle === "") {
            newNoteTitle = currentMyNote.title;
            setCurrentMyNoteTitle(newNoteTitle);
        }

        const newNote: MyNoteProps = {
            ...currentMyNote,
            title: newNoteTitle,
            body: body || [],
        };

        try {
            // Send the update note to the backend
            await sendUpdatedMyNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(1, newNote);

            setNoteBodyEdited(false);
            setNoteBodySaved(true);

            // Notify parent component of the update
            onNoteUpdate(newNote);
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    }, [currentMyNote, currentMyNoteTitle, body, myself, accessToken, onNoteUpdate]);

    // Keep the latest save fn and edited flag in refs so the debounce timer
    // and unmount flush always read fresh values without resetting themselves.
    const updateNoteRef = useRef(updateNote);
    updateNoteRef.current = updateNote;

    const noteBodyEditedRef = useRef(noteBodyEdited);
    noteBodyEditedRef.current = noteBodyEdited;

    // Debounced auto-save: fires AUTO_SAVE_DELAY_MS after the user's last body
    // edit. Each new edit resets the timer, so a continuously typing user is
    // never interrupted mid-stream.
    useEffect(() => {
        if (!noteBodyEdited) return;

        const timerId = setTimeout(() => {
            updateNoteRef.current();
        }, AUTO_SAVE_DELAY_MS);

        return () => clearTimeout(timerId);
    }, [body, noteBodyEdited]);

    // Best-effort flush on unmount so a navigation while a debounce is pending
    // still persists the latest edit.
    useEffect(() => {
        return () => {
            if (noteBodyEditedRef.current) {
                updateNoteRef.current();
            }
        };
    }, []);

    const handleTitleChange = useCallback((value: string) => {
        setCurrentMyNoteTitle(value);
    }, []);

    const handleTitleBlur = useCallback(() => {
        updateNote();
    }, [updateNote]);

    const handleBodyChange = useCallback((newBody: PartialBlock[]) => {
        setBody(newBody);
        setNoteBodyEdited(true);
        setNoteBodySaved(false);
    }, []);

    return {
        currentMyNoteTitle,
        setCurrentMyNoteTitle,
        titleInputRef,
        handleTitleChange,
        handleTitleBlur,
        body,
        setBody,
        handleBodyChange,
        noteBodyEdited,
        noteBodySaved,
        setNoteBodyEdited,
        setNoteBodySaved,
        updateNote,
    };
};
