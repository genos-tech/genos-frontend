import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { getCachedNote, noteCacheKind } from "../../../../hooks/notes/useNoteData";
import { UserProps } from "../../../../types/admin";
import { EditableNote, saveNote } from "../services/saveNote";

// Debounce delay between the user's last body edit and the auto-save firing.
const AUTO_SAVE_DELAY_MS = 3000;

// How long the "saved" indicator stays visible after a successful save.
const SAVED_INDICATOR_DURATION_MS = 5000;

export interface UseNoteEditorCoreProps<T extends EditableNote> {
    currentNote: T | null;
    myself: UserProps;
    accessToken: string | null;
    // Threaded into `saveNote` so the PUT response can emit the
    // `note_mention` event when the body's mention set changes.
    socket: Socket | null;
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
    socket,
    onNoteUpdate,
    resyncSignal,
}: UseNoteEditorCoreProps<T>): UseNoteEditorCoreReturn {
    const [body, setBody] = useState<PartialBlock[] | undefined>(
        currentNote?.body as PartialBlock[] | undefined
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // ## Title: one authority, plus an overlay while renaming
    //
    // `currentNote.title` is the authority — it comes from the reactive
    // `useNoteData` cache, which every persisted edit writes (see
    // `saveNote`). `pendingTitle` holds the user's in-progress rename in
    // THIS panel and nothing else, so the displayed title is otherwise
    // DERIVED and cannot drift from the note.
    //
    // This used to be a permanent local copy, reconciled against the
    // note's title on every render. That reconciliation could get stuck:
    // it recorded "I have already seen this external title" even on the
    // renders where it declined to adopt it (while the local title was
    // dirty), so a title skipped once was never retried. The panel then
    // displayed the old title indefinitely and its next body autosave PUT
    // that stale title back over the rename — the "note title reverts to
    // the default" bug, seen when the same note is open in two mounted
    // panels at once (the task/chat-page inline editor plus the
    // notes-home LRU pool panel, which stays mounted because NoteHome is
    // kept-alive). Deriving the value makes that state unreachable.
    const [pendingTitle, setPendingTitle] = useState<string | null>(null);
    const title = pendingTitle ?? currentNote?.title ?? "";

    const identityKey = identityOf(currentNote, resyncSignal);
    const [syncedIdentityKey, setSyncedIdentityKey] = useState<string>(identityKey);

    if (syncedIdentityKey !== identityKey) {
        // Note identity changed (tab switch / restore): abandon any
        // in-progress rename and re-seed the body from the new note. The
        // title needs no re-seeding — it is derived from `currentNote`.
        setSyncedIdentityKey(identityKey);
        setPendingTitle(null);
        setBody(currentNote ? (currentNote.body as PartialBlock[]) : undefined);
        setNoteBodyEdited(false);
        setNoteBodySaved(false);
    }

    // Kept so the editor hooks can keep exposing a `setCurrentXxxNoteTitle`
    // setter. Writing the title directly counts as a local rename, exactly
    // like typing in the input.
    const titleRef = useRef(title);
    titleRef.current = title;
    const setTitle = useCallback<Dispatch<SetStateAction<string>>>((value) => {
        setPendingTitle((prev) =>
            typeof value === "function" ? value(prev ?? titleRef.current) : value
        );
    }, []);

    const updateNote = useCallback(async () => {
        if (!currentNote || !accessToken) return;

        // Owner check: short-circuit if `title`/`body` don't yet correspond
        // to `currentNote`. This is the window (one render) right after a
        // tab switch where a pending debounce timer would otherwise persist
        // the previous note's content onto the new note.
        if (syncedIdentityKey !== identityOf(currentNote, resyncSignal)) {
            return;
        }

        // Resolve the title from the freshest source at SAVE time. A save
        // triggered by a BODY edit must never carry this panel's snapshot
        // of the title: the note may have been renamed on another surface
        // since the snapshot was taken, and re-sending the old value would
        // revert that rename. The shared cache is written by every
        // persisted edit, so it outranks `currentNote`; only an
        // in-progress local rename outranks the cache.
        //
        // An empty `pendingTitle` (the user cleared the input) is treated
        // as "no rename" rather than persisted as a blank title.
        const persisted = getCachedNote(noteCacheKind(currentNote.noteType), currentNote.noteId);
        const newNoteTitle = pendingTitle || persisted?.title || currentNote.title;

        const newNote = {
            ...currentNote,
            title: newNoteTitle,
            body: body || [],
        } as T;

        try {
            await saveNote(newNote, myself, accessToken, socket);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
            onNoteUpdate?.(newNote);
        } catch (error) {
            console.error("Failed to update note:", error);
        } finally {
            // The rename attempt is over either way, so stop overriding the
            // note's own title. Holding the overlay after a FAILURE is what
            // made this bug so persistent: the panel went on displaying —
            // and, on its next body autosave, PUTting — a title the note
            // did not have, clobbering renames made on other surfaces. On
            // success the note now carries this title anyway (`saveNote`
            // published it to the cache), so the derived value is
            // unchanged; on failure the input snaps back to the note's real
            // title, which is honest feedback that nothing was saved.
            setPendingTitle(null);
        }
    }, [
        currentNote,
        pendingTitle,
        body,
        myself,
        accessToken,
        socket,
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

    // Auto-clear the "saved" indicator after a short delay so it behaves
    // like a transient confirmation rather than a sticky badge.
    useEffect(() => {
        if (!noteBodySaved) return;

        const timerId = setTimeout(() => {
            setNoteBodySaved(false);
        }, SAVED_INDICATOR_DURATION_MS);

        return () => clearTimeout(timerId);
    }, [noteBodySaved]);

    const handleTitleChange = useCallback((value: string) => {
        // The overlay is itself the "the user is renaming in this panel"
        // signal: while it is set, a title change arriving from another
        // surface can't overwrite what is being typed. `updateNote` clears
        // it once the rename is persisted.
        setPendingTitle(value);
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
