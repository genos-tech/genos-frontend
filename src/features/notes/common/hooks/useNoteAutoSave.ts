import { useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { sendUpdatedTaskNote } from "../../task-notes/services/sendUpdatedTaskNote";
import { addNote } from "../services/addNote";

interface UseNoteAutoSaveProps {
    currentTaskNote: TaskNoteProps | null;
    currentTaskNoteTitle: string;
    body: PartialBlock[] | undefined;
    myself: UserProps;
    accessToken: string;
}

// Debounce delay between the user's last body edit and the auto-save firing.
const AUTO_SAVE_DELAY_MS = 3000;

export const useNoteAutoSave = ({
    currentTaskNote,
    currentTaskNoteTitle,
    body,
    myself,
    accessToken,
}: UseNoteAutoSaveProps) => {
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);

    const updateNote = useCallback(async () => {
        if (!currentTaskNote) return;

        let newNoteTitle = currentTaskNoteTitle;

        // If the note title is empty, use the note original title
        if (currentTaskNoteTitle === "") {
            newNoteTitle = currentTaskNote.title;
        }

        const newNote: TaskNoteProps = {
            ...currentTaskNote,
            title: newNoteTitle,
            body: body || [],
        };

        try {
            // Send the update note to the backend
            await sendUpdatedTaskNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(2, newNote);

            setNoteBodyEdited(false);
            setNoteBodySaved(true);

            // Tab items and task note meta are kept in sync by the parent
            // component (TaskNoteMain) via its noteBodySaved-driven effect.
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    }, [currentTaskNote, currentTaskNoteTitle, body, myself, accessToken]);

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

    return {
        noteBodyEdited,
        noteBodySaved,
        setNoteBodyEdited,
        setNoteBodySaved,
        updateNote,
    };
};
