import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../../../types/admin";
import { EditableNote, saveNote } from "../services/saveNote";

// Debounce delay between the user's last body edit and the auto-save firing.
const AUTO_SAVE_DELAY_MS = 3000;

export interface UseNoteEditorCoreProps<T extends EditableNote> {
    currentNote: T | null;
    myself: UserProps;
    accessToken: string | null;
    onNoteUpdate?: (updatedNote: T) => void;
}

export interface UseNoteEditorCoreReturn {
    title: string;
    setTitle: Dispatch<SetStateAction<string>>;
    body: PartialBlock[] | undefined;
    setBody: Dispatch<SetStateAction<PartialBlock[] | undefined>>;
    noteBodyEdited: boolean;
    setNoteBodyEdited: Dispatch<SetStateAction<boolean>>;
    noteBodySaved: boolean;
    setNoteBodySaved: Dispatch<SetStateAction<boolean>>;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    handleTitleChange: (value: string) => void;
    handleTitleBlur: () => void;
    handleBodyChange: (newBody: PartialBlock[]) => void;
    updateNote: () => Promise<void>;
}

const identityOf = (note: EditableNote | null): string =>
    note ? `${note.noteType}-${note.noteId}` : "";

/**
 * Shared editor state + auto-save engine for personal, task, and chat notes.
 *
 * Owns the `title`, `body`, `noteBodyEdited`, and `noteBodySaved` state for the
 * currently active note, debounces saves while the user types, and dispatches
 * the persistence call through the shared `saveNote` service.
 *
 * ## Tab-switch race protection
 *
 * Re-syncs `title`/`body` from `currentNote` synchronously inside render
 * (using React's "adjust state during render" idiom) whenever the note's
 * identity (`noteType-noteId`) changes. This prevents the "previous note's
 * title flashes onto the new note" rendering glitch that would otherwise
 * occur for one render after a tab switch.
 *
 * The same identity stamp guards `updateNote`: a stale debounced save fired
 * while a tab switch is mid-flight (e.g. `currentNote` already flipped to
 * the new tab but local `title`/`body` haven't been re-synced yet) is
 * short-circuited so it can't corrupt the new note with the previous note's
 * title or body. This was the root cause of the "title of note A is
 * overwritten by the title of note C after switching tabs" bug for huge
 * notes, where the resync window was long enough for the timer to land in
 * an inconsistent state.
 */
export function useNoteEditorCore<T extends EditableNote>({
    currentNote,
    myself,
    accessToken,
    onNoteUpdate,
}: UseNoteEditorCoreProps<T>): UseNoteEditorCoreReturn {
    const [title, setTitle] = useState<string>(currentNote?.title ?? "");
    const [body, setBody] = useState<PartialBlock[] | undefined>(
        currentNote?.body as PartialBlock[] | undefined
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const identityKey = identityOf(currentNote);
    const [syncedIdentityKey, setSyncedIdentityKey] = useState<string>(identityKey);

    if (syncedIdentityKey !== identityKey) {
        setSyncedIdentityKey(identityKey);
        if (currentNote) {
            setTitle(currentNote.title);
            setBody(currentNote.body as PartialBlock[]);
        } else {
            setTitle("");
            setBody(undefined);
        }
        setNoteBodyEdited(false);
        setNoteBodySaved(false);
    }

    const updateNote = useCallback(async () => {
        if (!currentNote || !accessToken) return;

        // Owner check: short-circuit if `title`/`body` don't yet correspond
        // to `currentNote`. This is the window (one render) right after a
        // tab switch where a pending debounce timer would otherwise persist
        // the previous note's content onto the new note.
        if (syncedIdentityKey !== identityOf(currentNote)) {
            return;
        }

        let newNoteTitle = title;
        if (title === "") {
            newNoteTitle = currentNote.title;
            setTitle(newNoteTitle);
        }

        const newNote = {
            ...currentNote,
            title: newNoteTitle,
            body: body || [],
        } as T;

        try {
            await saveNote(newNote, myself, accessToken);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
            onNoteUpdate?.(newNote);
        } catch (error) {
            console.error("Failed to update note:", error);
        }
    }, [currentNote, title, body, myself, accessToken, onNoteUpdate, syncedIdentityKey]);

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

    // Best-effort flush on unmount so navigation while a debounce is pending
    // still persists the latest edit.
    useEffect(() => {
        return () => {
            if (noteBodyEditedRef.current) {
                updateNoteRef.current();
            }
        };
    }, []);

    const handleTitleChange = useCallback((value: string) => {
        setTitle(value);
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
        title,
        setTitle,
        body,
        setBody,
        noteBodyEdited,
        setNoteBodyEdited,
        noteBodySaved,
        setNoteBodySaved,
        titleInputRef,
        handleTitleChange,
        handleTitleBlur,
        handleBodyChange,
        updateNote,
    };
}
