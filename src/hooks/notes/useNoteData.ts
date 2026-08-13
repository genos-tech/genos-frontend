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

// Reactive layer over the module-level cache.
//
// The cache is shared across every mounted `useNoteData` consumer, but a
// plain `Map` write is invisible to instances that already read it — they
// keep their stale `note` snapshot. That is the root cause of the
// task/chat note "title reverts to the default" bug: a note is open in two
// mounted panels at once (e.g. the task-page inline editor + the
// notes-home LRU-pool panel, which stays mounted because NoteHome is
// kept-alive), a rename saved from one panel writes the cache, but the
// other panel never sees it and its next autosave PUTs the stale title
// back over the rename.
//
// So writes go through `writeCache`, which notifies subscribers keyed by
// cache key (`${kind}-${noteId}` === the tab id). Keying by note means a
// write to note A never re-renders a panel showing note B. Notification is
// synchronous: every caller (`onNoteUpdate` after a save, sidebar moves,
// note creation, tab rehydrate) runs inside an event handler / effect /
// post-`await` continuation — never a render body — so the subscriber
// `setState` is a normal cross-component update, not a render-phase one.
type CacheSubscriber = (note: ResolvedNote) => void;
const cacheSubscribers = new Map<string, Set<CacheSubscriber>>();

const subscribeToNote = (key: string, cb: CacheSubscriber): (() => void) => {
    let set = cacheSubscribers.get(key);
    if (!set) {
        set = new Set();
        cacheSubscribers.set(key, set);
    }
    set.add(cb);
    return () => {
        const current = cacheSubscribers.get(key);
        if (!current) return;
        current.delete(cb);
        if (current.size === 0) cacheSubscribers.delete(key);
    };
};

const writeCache = (key: string, note: ResolvedNote): void => {
    cache.set(key, note);
    const subs = cacheSubscribers.get(key);
    if (subs) subs.forEach((cb) => cb(note));
};

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
                return cacheFetchedNote(fetched);
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
                return cacheFetchedNote(fetched);
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
            return cacheFetchedNote(fetched);
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
                // This fetch was started on a cache MISS, but a save may
                // have published a newer copy of the note while it was in
                // flight — that copy wins (see `fillNoteCache`).
                const effective = fillNoteCache(resolved);
                setNote(effective as T);
                if (lastFetchedKeyRef.current !== key) {
                    lastFetchedKeyRef.current = key;
                    onFirstResolveRef.current?.(effective);
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

    // Adopt cross-surface writes to THIS tab's note. When another mounted
    // panel (or the chat-page panel) saves a rename, `writeCache` fires
    // this subscriber so our `note` snapshot stays current — otherwise our
    // next autosave would send the stale title and clobber the rename.
    // Re-subscribes when the tab changes; `setNote` is a stable setter.
    useEffect(() => {
        if (!tab) return;
        const key = cacheKey(tab);
        return subscribeToNote(key, (updated) => {
            setNote(updated as T);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab?.id]);

    const update = useCallback(
        (next: T) => {
            if (!tab) return;
            const key = cacheKey(tab);
            writeCache(key, next);
            setNote(next);
        },
        [tab]
    );

    return { note, isLoading, error, accessDenied, update };
}

export const noteCacheKind = (noteType: number): "my" | "task" | "chat" =>
    noteType === 1 ? "my" : noteType === 2 ? "task" : "chat";

// Imperative cache write for code paths that don't render a `useNoteData`
// consumer but still need the cache to reflect a MUTATION (e.g. the
// chat-panel save path, note creation, a sidebar move, a version
// restore). Use `fillNoteCache` instead for anything that merely READ the
// note back from IndexedDB or the backend.
export const upsertNoteCache = (note: ResolvedNote): void => {
    writeCache(`${noteCacheKind(note.noteType)}-${note.noteId}`, note);
};

// Read-through fill: seed the cache from a note we just READ out of
// IndexedDB or the backend, WITHOUT displacing an entry that is already
// there. Returns whichever note now holds the cache, so callers keep
// using the winner rather than the copy they read.
//
// Reads are stale by the time they resolve — they're async (IDB goes
// through a worker), so a save that landed while the read was in flight
// has ALREADY published a newer note here. Overwriting it would push the
// pre-save title back into every mounted panel through the subscriber
// above, and that panel's next autosave would then PUT the old title over
// the save. This is the "note title reverts to the default" bug: the
// reader's title input went stale while the tab label and sidebar (which
// these read paths never touch) kept the correct title.
//
// So the in-memory cache is the newest client tier and a read never wins
// against it; only `upsertNoteCache` may replace an entry.
export const fillNoteCache = <T extends ResolvedNote>(note: T): T => {
    const key = `${noteCacheKind(note.noteType)}-${note.noteId}`;
    const existing = cache.get(key) as T | undefined;
    if (existing) return existing;
    writeCache(key, note);
    return note;
};

// Mirror a note we just fetched from the BACKEND into both client tiers,
// oldest-loses, and return whichever copy won.
//
// `fillNoteCache` alone only protects the in-memory tier. Every backend read
// also mirrored its row into IndexedDB with a bare `addNote`, which has no
// recency check — so a read that lost the race was correctly rejected from
// memory and then written to IndexedDB anyway, rolling the persisted row
// back to the pre-rename title. Nothing looked wrong until the next page
// load, when the cache starts empty and that stale row is what IndexedDB
// hands back: the same "title reverts to the default" report, one reload
// later.
//
// If the cache already holds a copy, that copy came from a mutation
// (`upsertNoteCache`), and mutations write IndexedDB themselves — so
// skipping the mirror here loses nothing.
export const cacheFetchedNote = <T extends ResolvedNote>(note: T): T => {
    const effective = fillNoteCache(note);
    if (effective === note) {
        addNote(note.noteType as 1 | 2 | 3, note);
    }
    return effective;
};

// Subscribe to writes for ONE note, for surfaces that hold their own copy
// instead of rendering through `useNoteData`. The chat-PAGE note panel is
// the only such surface (`useChatPanelNote`): it keeps the open note in
// plain `useState`, so without this it never learns about a rename made on
// the notes page, and its next body autosave PUTs the title it is still
// holding. Returns an unsubscribe fn; safe to call from an effect.
export const subscribeToNoteCache = (
    kind: "my" | "task" | "chat",
    noteId: number,
    cb: CacheSubscriber
): (() => void) => subscribeToNote(`${kind}-${noteId}`, cb);

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
