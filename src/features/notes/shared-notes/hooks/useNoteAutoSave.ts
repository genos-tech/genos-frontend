import { useEffect, useState } from "react";
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
    setTabItems: (items: TaskNoteProps[]) => void;
    setTaskNoteMeta: (meta: any[]) => void;
}

export const useNoteAutoSave = ({
    currentTaskNote,
    currentTaskNoteTitle,
    body,
    myself,
    accessToken,
    setTabItems,
    setTaskNoteMeta,
}: UseNoteAutoSaveProps) => {
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);

    // Auto save note body every 3 seconds if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

    const updateNote = async () => {
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

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);

            // Update the note title on the tab
            // Note: This would need to be handled by the parent component
            // as we can't directly update the tab items here

            // Update the note title in the sidebar
            // Note: This would need to be handled by the parent component
            // as we can't directly update the task note meta here
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    };

    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote]);

    return {
        noteBodyEdited,
        noteBodySaved,
        setNoteBodyEdited,
        setNoteBodySaved,
        updateNote,
    };
};
