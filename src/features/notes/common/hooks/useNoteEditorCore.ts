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
    // Bumped externally to force a re-sync of local `title`/`body` from
    // `currentNote` even when the note identity hasn't changed (e.g.
    // restore-from-history, which rewrites the body but keeps the same
    // noteType/noteId).
    resyncSignal?: number | string;
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

const identityOf = (
    note: EditableNote | null,
    resyncSignal: number | string | undefined
): string => {
    if (!note) return "";
    const suffix = resyncSignal !== undefined ? `-${resyncSignal}` : "";
    return `${note.noteType}-${note.noteId}${suffix}`;
};

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
    resyncSignal,
}: UseNoteEditorCoreProps<T>): UseNoteEditorCoreReturn {
    const [title, setTitle] = useState<string>(currentNote?.title ?? "");
    const [body, setBody] = useState<PartialBlock[] | undefined>(
        currentNote?.body as PartialBlock[] | undefined
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const identityKey = identityOf(currentNote, resyncSignal);
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
        if (syncedIdentityKey !== identityOf(currentNote, resyncSignal)) {
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
    }, [
        currentNote,
        title,
        body,
        myself,
        accessToken,
        onNoteUpdate,
        syncedIdentityKey,
        resyncSignal,
    ]);

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
        // Pure body sync. The edited / saved flags are intentionally
        // NOT flipped here — `BlockNoteView.onChange` fires whenever
        // the document changes for ANY reason (initial body load,
        // Yjs sync, remote collaborator typing) and auto-setting
        // `noteBodyEdited` from this path triggered spurious
        // auto-saves the moment a note opened. The note editors flip
        // those flags themselves, gated on `userInteractedRef` so
        // only real local keystrokes / paste / drop / IME input
        // count as edits.
        setBody(newBody);
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
