import { useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { addNote } from "../../features/notes/services/addNote";
import { sendUpdatedMyNote } from "../../features/notes/services/sendUpdatedMyNote";
import {
    NoteEditorActions,
    NoteEditorProps,
    NoteEditorState,
} from "../../features/notes/types/noteEditor";
import { UserProps } from "../../types/admin";
import { MyNoteProps } from "../../types/notes";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

interface UseNoteEditorReturn extends NoteEditorState, NoteEditorActions {}

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
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
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

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);

            // Notify parent component of the update
            onNoteUpdate(newNote);
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    }, [currentMyNote, currentMyNoteTitle, body, myself, accessToken, onNoteUpdate]);

    // Auto-save functionality
    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote, updateNote]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

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
