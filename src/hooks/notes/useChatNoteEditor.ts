import { useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { sendUpdatedChatNote } from "../../features/notes/chat-notes/services/sendUpdatedChatNote";
import { addNote } from "../../features/notes/shared/services/addNote";
import { UserProps } from "../../types/admin";
import { ChatNoteProps } from "../../types/notes";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

export interface ChatNoteEditorState {
    currentChatNoteTitle: string;
    noteBodyEdited: boolean;
    noteBodySaved: boolean;
    body: PartialBlock[] | undefined;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface ChatNoteEditorActions {
    setCurrentChatNoteTitle: (title: string) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    setBody: (body: PartialBlock[]) => void;
    handleTitleChange: (value: string) => void;
    handleTitleBlur: () => void;
    handleBodyChange: (newBody: PartialBlock[]) => void;
    updateNote: () => Promise<void>;
}

export interface ChatNoteEditorProps {
    currentChatNote: ChatNoteProps | null;
    myself: UserProps;
    accessToken: string | null;
    onNoteUpdate: (updatedNote: ChatNoteProps) => void;
}

interface UseChatNoteEditorReturn extends ChatNoteEditorState, ChatNoteEditorActions {}

/**
 * Custom hook for managing chat note editing functionality
 * Handles title editing, body editing, auto-save, and note updates
 *
 * @param props - Configuration object for the chat note editor
 * @returns Object containing state and actions for chat note editing
 */
export const useChatNoteEditor = ({
    currentChatNote,
    myself,
    accessToken,
    onNoteUpdate,
}: ChatNoteEditorProps): UseChatNoteEditorReturn => {
    const [currentChatNoteTitle, setCurrentChatNoteTitle] = useState<string>(
        currentChatNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // Update note title and body when current note changes
    useEffect(() => {
        if (currentChatNote) {
            setCurrentChatNoteTitle(currentChatNote.title);
            setBody(currentChatNote.body);
        }
    }, [currentChatNote]);

    const updateNote = useCallback(async () => {
        if (!currentChatNote || !accessToken) return;

        let newNoteTitle = currentChatNoteTitle;

        // If the note title is empty, use the note original title
        if (currentChatNoteTitle === "") {
            newNoteTitle = currentChatNote.title;
            setCurrentChatNoteTitle(newNoteTitle);
        }

        const newNote: ChatNoteProps = {
            ...currentChatNote,
            title: newNoteTitle,
            body: body || [],
        };

        try {
            // Send the update note to the backend
            await sendUpdatedChatNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(3, newNote);

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);

            // Notify parent component of the update
            onNoteUpdate(newNote);
        } catch (error) {
            console.error("Failed to update chat note:", error);
        }
    }, [currentChatNote, currentChatNoteTitle, body, myself, accessToken, onNoteUpdate]);

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
        setCurrentChatNoteTitle(value);
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
        currentChatNoteTitle,
        setCurrentChatNoteTitle,
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
