// Per-tab note data fetching hook.
//
// Replaces the legacy `loadNote` / `current{My,Task,Chat}Note` state with a
// cache keyed by `${kind}-${noteId}`. The active tab's renderer calls
// `useNoteData(tab)` and naturally cancels (via React's unmount) if the
// user switches tabs before the fetch resolves; the data only ever lands
// in the cache for the originating tab id.
//
// Caching strategy:
//   - In-memory `Map` shared across hook instances per session, so revisits
//     are instant and don't trigger a refetch storm.
//   - IDB-first via `NoteService`, backend fallback via `loadSpecificNote`.
//   - `recordNoteOpen` is called once per first successful resolve so
//     the recents list still reorders.

import { useCallback, useEffect, useRef, useState } from "react";

import { NoteService } from "../../db/services/note.service";
import { addNote } from "../../features/notes/common/services/addNote";
import { loadSpecificNote } from "../../features/notes/common/services/loadSpecificNote";
import { UserProps } from "../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import type { NoteTab } from "./useNoteTabs";

export type ResolvedNote = MyNoteProps | TaskNoteProps | ChatNoteProps;

export interface UseNoteDataResult<T extends ResolvedNote = ResolvedNote> {
    note: T | null;
    isLoading: boolean;
    error: Error | null;
    // True when the backend answered 403 for this note: it EXISTS but the
    // caller has no role on it (the shared-URL case). Renderers show the
    // "request access" panel instead of a blank editor. Never cached, so
    // a granted request takes effect on the next open without a reload.
    accessDenied: boolean;
    update: (next: T) => void;
}

// Sentinel distinguishing "no access" from "not found" in fetchForTab's
// return channel.
const FORBIDDEN = Symbol("note-access-forbidden");

interface UseNoteDataOptions {
    myself: UserProps;
    accessToken: string | null;
    onFirstResolve?: (note: ResolvedNote) => void;
}

const cache = new Map<string, ResolvedNote>();

const noteServiceSingleton: { current: NoteService | null } = { current: null };
const getNoteService = (): NoteService => {
    if (!noteServiceSingleton.current) {
        noteServiceSingleton.current = new NoteService();
    }
    return noteServiceSingleton.current;
};

const cacheKey = (tab: NoteTab): string => tab.id;

const fetchForTab = async (
    tab: NoteTab,
    myself: UserProps,
    accessToken: string | null
): Promise<ResolvedNote | typeof FORBIDDEN | null> => {
    const ns = getNoteService();
    try {
        if (tab.kind === "my") {
            const cached = await ns.getPersonalNote(tab.noteId);
            if (cached) {
                return { ...cached, noteType: 1 } as MyNoteProps;
            }
            if (!accessToken) return null;
            const fetched: MyNoteProps = await loadSpecificNote(
                myself,
                1,
                tab.noteId,
                accessToken
            );
            if (fetched?.error === "forbidden") return FORBIDDEN;
            if (fetched && !fetched.error && fetched.noteType === 1) {
                addNote(1, fetched);
                return fetched;
            }
            return null;
        }
        if (tab.kind === "task") {
            const cached = await ns.getTaskNote(tab.noteId);
            if (cached) {
                return { ...cached, noteType: 2 } as TaskNoteProps;
            }
            if (!accessToken) return null;
            const fetched: TaskNoteProps = await loadSpecificNote(
                myself,
                2,
                tab.noteId,
                accessToken
            );
            if (fetched?.error === "forbidden") return FORBIDDEN;
            if (fetched && !fetched.error && fetched.noteType === 2) {
                addNote(2, fetched);
                return fetched;
            }
            return null;
        }
        const cached = await ns.getChatNote(tab.noteId);
        if (cached) {
            return { ...cached, noteType: 3 } as ChatNoteProps;
        }
        if (!accessToken) return null;
        const fetched: ChatNoteProps = await loadSpecificNote(myself, 3, tab.noteId, accessToken);
        if (fetched?.error === "forbidden") return FORBIDDEN;
        if (fetched && !fetched.error && fetched.noteType === 3) {
            addNote(3, fetched);
            return fetched;
        }
        return null;
    } catch {
        return null;
    }
};

export function useNoteData<T extends ResolvedNote = ResolvedNote>(
    tab: NoteTab | null,
    options: UseNoteDataOptions
): UseNoteDataResult<T> {
    const { myself, accessToken, onFirstResolve } = options;

    const [note, setNote] = useState<T | null>(() => {
        if (!tab) return null;
        const cached = cache.get(cacheKey(tab));
        return (cached as T | undefined) ?? null;
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [accessDenied, setAccessDenied] = useState<boolean>(false);

    const lastFetchedKeyRef = useRef<string | null>(null);
    const onFirstResolveRef = useRef(onFirstResolve);
    onFirstResolveRef.current = onFirstResolve;

    useEffect(() => {
        if (!tab) {
            setNote(null);
            setIsLoading(false);
            setError(null);
            setAccessDenied(false);
            lastFetchedKeyRef.current = null;
            return;
        }

        const key = cacheKey(tab);
        const cached = cache.get(key) as T | undefined;
        if (cached) {
            setNote(cached);
            setError(null);
            setAccessDenied(false);
            // Do not refetch when we have a cached copy; mutations write
            // through `update()` and IDB writes go via addNote inside the
            // editor save path. Skipping the refetch is what makes tab
            // switching feel instant.
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setAccessDenied(false);
        (async () => {
            const resolved = await fetchForTab(tab, myself, accessToken);
            if (cancelled) return;
            if (resolved === FORBIDDEN) {
                // Deliberately NOT cached: once the owner approves the
                // request, the next open refetches and succeeds.
                setAccessDenied(true);
            } else if (resolved) {
                cache.set(key, resolved);
                setNote(resolved as T);
                if (lastFetchedKeyRef.current !== key) {
                    lastFetchedKeyRef.current = key;
                    onFirstResolveRef.current?.(resolved);
                }
            } else {
                setError(new Error("note not found"));
            }
            setIsLoading(false);
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab?.id, accessToken, myself.teamId, myself.userId]);

    const update = useCallback(
        (next: T) => {
            if (!tab) return;
            const key = cacheKey(tab);
            cache.set(key, next);
            setNote(next);
        },
        [tab]
    );

    return { note, isLoading, error, accessDenied, update };
}

// Imperative cache mutation for code paths that don't render a
// `useNoteData` consumer but still need the cache to reflect a write
// (e.g. the chat-panel save path, or note creation).
export const upsertNoteCache = (note: ResolvedNote): void => {
    const kind = note.noteType === 1 ? "my" : note.noteType === 2 ? "task" : "chat";
    cache.set(`${kind}-${note.noteId}`, note);
};

// Synchronous read for callers that need to peek at the in-memory cache
// outside the React render cycle — used by the legacy active-tab sync
// effect in `useNoteManagement` to avoid a one-render "blackout" when
// the user switches between note types and the new note is already
// cached from a prior open or write-through.
export const getCachedNote = <T extends ResolvedNote = ResolvedNote>(
    kind: "my" | "task" | "chat",
    noteId: number
): T | null => {
    const hit = cache.get(`${kind}-${noteId}`);
    return (hit as T | undefined) ?? null;
};

export const removeFromNoteCache = (kind: "my" | "task" | "chat", noteId: number): void => {
    cache.delete(`${kind}-${noteId}`);
};

export const clearNoteCache = (): void => {
    cache.clear();
};
