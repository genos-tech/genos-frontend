import {
    Dispatch,
    RefObject,
    SetStateAction,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { getCachedNote, noteCacheKind } from "../../../../hooks/notes/useNoteData";
import { UserProps } from "../../../../types/admin";
import { isRetryableSaveError } from "../../../tasks/services/isRetryableSaveError";
import { EditableNote } from "../services/saveNote";
import { createNoteSaveSession, NoteSaveSession, sendNoteSave } from "./noteSaveSession";

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
    /** Hand this to the editor (`GenosNoteEditor`'s `bodyReadRef`): it lets a save read the
     *  words the editor has not yet synced into `body` (MIP-2454). */
    bodyReadRef: RefObject<(() => PartialBlock[]) | null>;
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
 * ## One save session per note
 *
 * Everything a save needs (the note, its body, the unsent title, what the server has confirmed)
 * lives in a `NoteSaveSession` that belongs to ONE `noteType-noteId`. A new identity gets a new
 * session during render (React's "adjust state during render" idiom), so a late timer or a late
 * response can never write one note's text or title onto another.
 *
 * ## What the editor shows is what gets stored (MIP-2454)
 *
 * A save carries the body as it was when it went out. When it returns, the editor is read again
 * and the note stays "edited" if anything differs. Saves of one note go out one at a time, a save
 * that stored nothing is not counted as saved, and leaving the note (unmount, or another note in
 * the same panel) sends what the timers had not.
 */
export function useNoteEditorCore<T extends EditableNote>({
    currentNote,
    myself,
    accessToken,
    socket,
    onNoteUpdate,
    resyncSignal,
}: UseNoteEditorCoreProps<T>): UseNoteEditorCoreReturn {
    const identityKey = identityOf(currentNote, resyncSignal);
    const [session, setSession] = useState<NoteSaveSession<T>>(() =>
        createNoteSaveSession(identityKey, currentNote)
    );
    const [body, setBodyState] = useState<PartialBlock[] | undefined>(session.body);
    const [noteBodyEdited, setNoteBodyEditedState] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    // Bumped to arm the autosave again when a save left something unsent.
    const [saveRound, setSaveRound] = useState(0);
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
    const [pendingTitle, setPendingTitleState] = useState<string | null>(null);
    const title = pendingTitle ?? currentNote?.title ?? "";

    if (session.key !== identityKey) {
        // Note identity changed (tab switch / restore): abandon the local state and re-seed the
        // body from the new note. The title needs no re-seeding, it is derived from
        // `currentNote`. What the old note had not saved is sent by the layout effect below.
        const next = createNoteSaveSession(identityKey, currentNote);
        setSession(next);
        setPendingTitleState(null);
        setBodyState(next.body);
        setNoteBodyEditedState(false);
        setNoteBodySaved(false);
    } else {
        session.note = currentNote;
        session.onNoteUpdate = onNoteUpdate;
    }

    const sessionRef = useRef(session);
    sessionRef.current = session;
    const senderRef = useRef({ myself, accessToken, socket });
    senderRef.current = { myself, accessToken, socket };

    // The setters write the session first: a save reads it, not the state of the last render.
    // A setter an outgoing editor still holds only updates its own session.
    const setBody = useCallback<Dispatch<SetStateAction<PartialBlock[] | undefined>>>(
        (value) => {
            session.body = typeof value === "function" ? value(session.body) : value;
            if (sessionRef.current === session) setBodyState(session.body);
        },
        [session]
    );
    const setNoteBodyEdited = useCallback<Dispatch<SetStateAction<boolean>>>(
        (value) => {
            session.edited = typeof value === "function" ? value(session.edited) : value;
            if (sessionRef.current === session) setNoteBodyEditedState(session.edited);
        },
        [session]
    );
    const setPendingTitle = useCallback<Dispatch<SetStateAction<string | null>>>(
        (value) => {
            session.pendingTitle =
                typeof value === "function" ? value(session.pendingTitle) : value;
            if (sessionRef.current === session) setPendingTitleState(session.pendingTitle);
        },
        [session]
    );

    // Kept so the editor hooks can keep exposing a `setCurrentXxxNoteTitle`
    // setter. Writing the title directly counts as a local rename, exactly
    // like typing in the input.
    const titleRef = useRef(title);
    titleRef.current = title;
    const setTitle = useCallback<Dispatch<SetStateAction<string>>>(
        (value) => {
            setPendingTitle((prev) =>
                typeof value === "function" ? value(prev ?? titleRef.current) : value
            );
        },
        [setPendingTitle]
    );

    /** `onlyIfChanged`: do not send a body the server has already confirmed. */
    const save = useCallback(async (target: NoteSaveSession<T>, onlyIfChanged: boolean) => {
        // Read the editor NOW: its sync into `body` is debounced, and it may be gone by
        // the time an earlier save of this note lets this one go.
        const typed = target.edited ? target.bodyReadRef.current?.() : undefined;
        if (typed) target.body = typed;

        const isShown = () => sessionRef.current === target;
        let sentTitle: string | null = null;
        let sent: T | null = null;
        try {
            const stored = await sendNoteSave(target, () => {
                const { myself, accessToken, socket } = senderRef.current;
                const note = target.note;
                if (target.dropped || !note || !accessToken) return null;
                if (
                    onlyIfChanged &&
                    !target.pendingTitle &&
                    JSON.stringify(target.body ?? []) === target.confirmedBody
                ) {
                    // Typed and then undone, or already carried by the save before this one.
                    target.edited = false;
                    if (isShown()) setNoteBodyEditedState(false);
                    return null;
                }
                // Resolve the title from the freshest source at SAVE time. A save
                // triggered by a BODY edit must never carry this panel's snapshot of the
                // title: the note may have been renamed on another surface since. The
                // shared cache is written by every persisted edit, so it outranks the
                // note; only an in-progress local rename outranks the cache. An empty
                // rename (the input was cleared) is not persisted as a blank title.
                sentTitle = target.pendingTitle;
                const persisted = getCachedNote(noteCacheKind(note.noteType), note.noteId);
                const payload = {
                    ...note,
                    title: sentTitle || persisted?.title || note.title,
                    body: target.body || [],
                } as T;
                sent = payload;
                return { note: payload, myself, accessToken, socket };
            });
            if (!stored || !sent) return;
        } catch (error) {
            console.error("Failed to update note:", error);
            // Nothing was stored. Stay "edited" and send it again when that can help.
            const retry = isRetryableSaveError(error);
            if (retry) target.backoff.failed();
            else target.edited = false;
            if (isShown()) {
                setNoteBodyEditedState(target.edited);
                setNoteBodySaved(false);
                setSaveRound((n) => n + 1);
            }
            return;
        } finally {
            // The rename attempt is over either way, so stop overriding the note's own
            // title: holding it after a failure made this panel PUT a title the note did
            // not have. A title typed since the save went out is a new attempt and stays.
            if (target.pendingTitle === sentTitle) {
                target.pendingTitle = null;
                if (isShown()) setPendingTitleState(null);
            }
        }

        const saved = sent as T;
        target.backoff.reset();
        target.confirmedBody = JSON.stringify(saved.body);
        // Words typed while the save was in flight (or still waiting in the editor's
        // debounce) are not in what was sent.
        const now = isShown() && target.edited ? target.bodyReadRef.current?.() : undefined;
        if (now) target.body = now;
        const unsent = target.edited && JSON.stringify(target.body ?? []) !== target.confirmedBody;
        target.edited = unsent;
        if (isShown()) {
            setBodyState(target.body);
            setNoteBodyEditedState(unsent);
            setNoteBodySaved(!unsent);
            if (unsent) setSaveRound((n) => n + 1);
        }
        target.onNoteUpdate?.(saved);
    }, []);

    const updateNote = useCallback(() => save(session, false), [save, session]);

    // Debounced auto-save: fires AUTO_SAVE_DELAY_MS after the user's last body
    // edit. Each new edit resets the timer, so a continuously typing user is
    // never interrupted mid-stream.
    useEffect(() => {
        if (!noteBodyEdited) return;

        const timerId = setTimeout(() => {
            if (!session.backoff.ready()) {
                setSaveRound((n) => n + 1);
                return;
            }
            void save(session, true);
        }, AUTO_SAVE_DELAY_MS);

        return () => clearTimeout(timerId);
    }, [body, noteBodyEdited, saveRound, session, save]);

    // Leaving the note (the panel unmounts, or shows another note) drops the editor's pending
    // sync and the timer above, so what they had not sent goes now. A LAYOUT effect: its
    // cleanup runs while the outgoing editor can still be read.
    useLayoutEffect(
        () => () => {
            const next = sessionRef.current;
            if (next !== session && next.noteKey === session.noteKey) {
                // The same note re-seeded (a restore from history): the old text must not
                // be written over it.
                session.dropped = true;
                return;
            }
            if (session.edited) void save(session, true);
        },
        [session, save]
    );

    // Auto-clear the "saved" indicator after a short delay so it behaves
    // like a transient confirmation rather than a sticky badge.
    useEffect(() => {
        if (!noteBodySaved) return;

        const timerId = setTimeout(() => {
            setNoteBodySaved(false);
        }, SAVED_INDICATOR_DURATION_MS);

        return () => clearTimeout(timerId);
    }, [noteBodySaved]);

    const handleTitleChange = useCallback(
        (value: string) => {
            // The overlay is itself the "the user is renaming in this panel"
            // signal: while it is set, a title change arriving from another
            // surface can't overwrite what is being typed. `save` clears
            // it once the rename is persisted.
            setPendingTitle(value);
        },
        [setPendingTitle]
    );

    const handleTitleBlur = useCallback(() => {
        void updateNote();
    }, [updateNote]);

    const handleBodyChange = useCallback(
        (newBody: PartialBlock[]) => {
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
        },
        [setBody]
    );

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
        bodyReadRef: session.bodyReadRef,
    };
}
