// Tab strip state for the notes-home view. This is the new synchronous API
// that replaces the effect-driven `tabItems` / `selectedTabIndex` /
// `current{My,Task,Chat}Note` machinery in `useNoteManagement`.
//
// All operations (`openTab` / `switchTab` / `closeTab` / `updateTabTitle`)
// are synchronous setState calls. The only async path is `rehydrate`, which
// runs once per teamId on mount to resolve persisted refs to titled tabs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NoteService } from "../../db/services/note.service";
import { loadSpecificNote } from "../../features/notes/common/services/loadSpecificNote";
import { UserProps } from "../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import {
    clearPersistedTabs,
    loadPersistedTabs,
    NoteTypeId,
    savePersistedTabs,
    TabRef,
    toRefs,
} from "./noteTabsPersistence";
import { fillNoteCache } from "./useNoteData";

// Which sidebar space a personal-backed note was opened FROM. All three
// are `note_type: 1` on the backend and share the editor, Yjs room and
// IndexedDB store — the bucket is the only thing that distinguishes
// them, and it cannot be re-derived from the note itself.
//
// It has to travel ON THE TAB. Without it, a team note opened from the
// Team Notes section becomes indistinguishable from a My Note the
// moment it lands in a tab, which is what made the header, the tab
// strip and note creation all treat team notes as personal ones.
export type NoteBucket = "my" | "shared" | "team";

export type NoteRef =
    | { kind: "my"; noteType: 1; noteId: number; bucket?: NoteBucket }
    | { kind: "task"; noteType: 2; noteId: number; projectId: number; taskId: number }
    | {
          kind: "chat";
          noteType: 3;
          noteId: number;
          chatType: number;
          chatId: number;
          isThread: boolean;
          threadId: number;
      };

export type NoteTabKind = NoteRef["kind"];

export type NoteTab = NoteRef & {
    id: string;
    title: string;
    teamId: string;
};

export interface NoteTabsApi {
    tabs: NoteTab[];
    activeTab: NoteTab | null;
    activeTabId: string | null;
    // Bumped on every `openTab` call, even when the requested tab is
    // already the active one (where React's `setActiveTabId` would
    // otherwise no-op and emit no signal). Mobile uses this to detect
    // repeat clicks on the already-open note in the sidebar tree so it
    // can switch the view back to the content pane.
    openTick: number;

    // LRU of tab ids whose editors are currently kept mounted. Front
    // is most-recent, capped at `NOTE_EDITOR_POOL_SIZE`. NoteContentRenderer
    // iterates this to render every live tab simultaneously (hiding all
    // but the active one), so re-visiting a recently-used tab doesn't
    // remount its BlockNote editor.
    liveTabIds: string[];

    openTab: (tab: NoteTab) => void;
    switchTab: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    updateTabTitle: (noteId: number, kind: NoteTabKind, title: string) => void;
    // Heal a personal-backed tab's bucket once the team/shared meta
    // lists can disambiguate it — see the implementation note.
    updateTabBucket: (noteId: number, bucket: NoteBucket) => void;
    rehydrate: () => Promise<void>;
}

export const tabIdFor = (kind: NoteTabKind, noteId: number): string => `${kind}-${noteId}`;

export const kindFromNoteType = (noteType: NoteTypeId | number): NoteTabKind => {
    if (noteType === 1) return "my";
    if (noteType === 2) return "task";
    return "chat";
};

export const noteTypeFromKind = (kind: NoteTabKind): NoteTypeId => {
    if (kind === "my") return 1;
    if (kind === "task") return 2;
    return 3;
};

// Cap mirrors the implicit cap of the legacy strip — there's no hard
// number, but in practice the persisted record had no upper bound and
// users rarely keep more than a few dozen tabs open. We add a soft cap
// so a runaway `openTab` loop can't grow the strip without bound.
const MAX_TABS = 10;

// Size of the "live" editor pool — how many of the user's most recently
// active tabs we keep mounted simultaneously (LRU). Mounted editors
// retain their BlockNote / Hocuspocus / Y.Doc state across tab
// switches, so re-visiting any of them is instant. Switching to a tab
// outside the pool still works — it just remounts like before.
//
// 5 is the sweet spot: covers the "rapid context-switch among a few
// related notes" UX without N×websocket-connection cost.
export const NOTE_EDITOR_POOL_SIZE = 5;

interface UseNoteTabsOptions {
    myself: UserProps;
    accessToken: string | null;
}

export const useNoteTabs = ({ myself, accessToken }: UseNoteTabsOptions): NoteTabsApi => {
    const [tabs, setTabs] = useState<NoteTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    // Counter bumped on every openTab call so consumers can observe
    // "user requested a note open" even when the requested tab is
    // already active (setActiveTabId with the same id is a no-op).
    const [openTick, setOpenTick] = useState(0);
    // LRU of tab ids with mounted editors (front = most recent). Capped
    // at NOTE_EDITOR_POOL_SIZE so the WebSocket + Y.Doc footprint stays
    // bounded.
    const [liveTabIds, setLiveTabIds] = useState<string[]>([]);
    const hasHydratedRef = useRef(false);
    const lastTeamIdRef = useRef<string | null>(null);

    const noteServiceRef = useRef<NoteService | null>(null);
    if (!noteServiceRef.current) {
        noteServiceRef.current = new NoteService();
    }

    // Latest values for sync handlers. Using refs avoids stale closures
    // in callbacks consumed by deep components without forcing them to
    // re-memoize.
    const tabsRef = useRef<NoteTab[]>(tabs);
    tabsRef.current = tabs;
    const activeIdRef = useRef<string | null>(activeTabId);
    activeIdRef.current = activeTabId;

    const activeTab = useMemo(
        () => tabs.find((t) => t.id === activeTabId) ?? null,
        [tabs, activeTabId]
    );

    // Resolve a single persisted ref to a full note (IDB-first, then
    // backend). Returns null when the note is gone server-side or never
    // reachable for this user, so the caller can drop it cleanly.
    const resolveRefToTab = useCallback(
        async (ref: TabRef, teamId: string): Promise<NoteTab | null> => {
            const ns = noteServiceRef.current;
            if (!ns) return null;
            // While resolving each persisted ref to a NoteTab, we also
            // seed the in-memory note cache (`useNoteData.cache`) with
            // the full body. This eliminates the brief "blackout" the
            // user saw on the very first tab switch after a fresh load,
            // by guaranteeing the active-tab sync effect can find a
            // synchronous cache hit.
            try {
                if (ref.noteType === 1) {
                    const cached = await ns.getPersonalNote(ref.noteId);
                    if (cached) {
                        const myNote = fillNoteCache<MyNoteProps>({ ...cached, noteType: 1 });
                        return {
                            kind: "my",
                            noteType: 1,
                            noteId: myNote.noteId,
                            // Carry the persisted bucket through, or the
                            // reload silently demotes team/shared tabs
                            // back to My Notes.
                            bucket: ref.bucket ?? "my",
                            id: tabIdFor("my", myNote.noteId),
                            title: myNote.title,
                            teamId,
                        };
                    }
                    if (!accessToken) return null;
                    const fetched = await loadSpecificNote(myself, 1, ref.noteId, accessToken);
                    if (fetched && !fetched.error) {
                        fillNoteCache(fetched as MyNoteProps);
                        return {
                            kind: "my",
                            noteType: 1,
                            noteId: fetched.noteId,
                            bucket: ref.bucket ?? "my",
                            id: tabIdFor("my", fetched.noteId),
                            title: fetched.title,
                            teamId,
                        };
                    }
                    return null;
                }
                if (ref.noteType === 2) {
                    const cached = await ns.getTaskNote(ref.noteId);
                    if (cached) {
                        const taskNote = fillNoteCache<TaskNoteProps>({ ...cached, noteType: 2 });
                        return {
                            kind: "task",
                            noteType: 2,
                            noteId: taskNote.noteId,
                            projectId: taskNote.projectId,
                            taskId: taskNote.taskId,
                            id: tabIdFor("task", taskNote.noteId),
                            title: taskNote.title,
                            teamId,
                        };
                    }
                    if (!accessToken) return null;
                    const fetched = await loadSpecificNote(myself, 2, ref.noteId, accessToken);
                    if (fetched && !fetched.error) {
                        fillNoteCache(fetched as TaskNoteProps);
                        return {
                            kind: "task",
                            noteType: 2,
                            noteId: fetched.noteId,
                            projectId: fetched.projectId,
                            taskId: fetched.taskId,
                            id: tabIdFor("task", fetched.noteId),
                            title: fetched.title,
                            teamId,
                        };
                    }
                    return null;
                }
                const cached = await ns.getChatNote(ref.noteId);
                if (cached) {
                    const chatNote = fillNoteCache<ChatNoteProps>({ ...cached, noteType: 3 });
                    return {
                        kind: "chat",
                        noteType: 3,
                        noteId: chatNote.noteId,
                        chatType: chatNote.chatType,
                        chatId: chatNote.chatId,
                        isThread: chatNote.isThread,
                        threadId: chatNote.threadId,
                        id: tabIdFor("chat", chatNote.noteId),
                        title: chatNote.title,
                        teamId,
                    };
                }
                if (!accessToken) return null;
                const fetched = await loadSpecificNote(myself, 3, ref.noteId, accessToken);
                if (fetched && !fetched.error) {
                    fillNoteCache(fetched as ChatNoteProps);
                    return {
                        kind: "chat",
                        noteType: 3,
                        noteId: fetched.noteId,
                        chatType: fetched.chatType,
                        chatId: fetched.chatId,
                        isThread: fetched.isThread,
                        threadId: fetched.threadId,
                        id: tabIdFor("chat", fetched.noteId),
                        title: fetched.title,
                        teamId,
                    };
                }
                return null;
            } catch {
                return null;
            }
        },
        [accessToken, myself]
    );

    const persist = useCallback(
        (nextTabs: NoteTab[], nextActiveId: string | null) => {
            if (!myself.teamId) return;
            const refs = toRefs(
                nextTabs.map((t) => ({
                    noteType: t.noteType,
                    noteId: t.noteId,
                    // Only the "my" variant carries a bucket; the others
                    // are unambiguous from their kind.
                    bucket: t.kind === "my" ? t.bucket : undefined,
                }))
            );
            // Find the index of the active tab so we can keep backwards
            // compatibility with the legacy `selectedTabIndex` field.
            const idx = nextActiveId ? nextTabs.findIndex((t) => t.id === nextActiveId) : 0;
            savePersistedTabs(myself.teamId, {
                selectedTabIndex: idx >= 0 ? idx : 0,
                tabs: refs,
            });
        },
        [myself.teamId]
    );

    // Promote a tab id to the front of the LRU pool. Idempotent — if
    // the id is already in the pool it just bubbles to the front. Pool
    // is sliced to NOTE_EDITOR_POOL_SIZE; anything pushed off the tail
    // is dropped (its editor unmounts on the next render).
    const bumpLive = useCallback((tabId: string) => {
        setLiveTabIds((prev) => {
            const filtered = prev.filter((id) => id !== tabId);
            return [tabId, ...filtered].slice(0, NOTE_EDITOR_POOL_SIZE);
        });
    }, []);

    const openTab = useCallback(
        (tab: NoteTab) => {
            if (!tab.teamId || tab.teamId !== myself.teamId) {
                return;
            }
            // Bump on every call (even when setActiveTabId below is a
            // no-op because the tab is already active) so consumers
            // can detect "user requested an open" as an event, not a
            // state diff.
            setOpenTick((n) => n + 1);
            const current = tabsRef.current;
            const existingIdx = current.findIndex((t) => t.id === tab.id);
            if (existingIdx !== -1) {
                // Already in strip — just focus and refresh title/fields
                // in case caller passed a newer copy of the same note.
                const merged = current.map((t, i) => (i === existingIdx ? { ...t, ...tab } : t));
                setTabs(merged);
                setActiveTabId(tab.id);
                bumpLive(tab.id);
                persist(merged, tab.id);
                return;
            }

            let next: NoteTab[];
            if (current.length >= MAX_TABS) {
                // Drop the oldest (front) so the strip can never grow unbounded.
                next = [...current.slice(1), tab];
            } else {
                next = [...current, tab];
            }
            setTabs(next);
            setActiveTabId(tab.id);
            bumpLive(tab.id);
            persist(next, tab.id);
        },
        [myself.teamId, persist, bumpLive]
    );

    const switchTab = useCallback(
        (tabId: string) => {
            const current = tabsRef.current;
            if (!current.some((t) => t.id === tabId)) return;
            if (activeIdRef.current === tabId) return;
            setActiveTabId(tabId);
            bumpLive(tabId);
            persist(current, tabId);
        },
        [persist, bumpLive]
    );

    const closeTab = useCallback(
        (tabId: string) => {
            const current = tabsRef.current;
            const idx = current.findIndex((t) => t.id === tabId);
            if (idx === -1) return;
            const next = current.filter((t) => t.id !== tabId);

            let nextActive: string | null = activeIdRef.current;
            if (activeIdRef.current === tabId) {
                if (next.length === 0) {
                    nextActive = null;
                } else {
                    // Pick the neighbour: prefer the one to the left, else the
                    // first remaining tab.
                    const neighbourIdx = Math.max(0, idx - 1);
                    nextActive = next[Math.min(neighbourIdx, next.length - 1)].id;
                }
            }

            setTabs(next);
            setActiveTabId(nextActive);
            // Drop the closed tab from the live pool so its editor
            // unmounts. If the active tab is now a different one, make
            // sure it's in (or at the front of) the pool.
            setLiveTabIds((prev) => {
                const without = prev.filter((id) => id !== tabId);
                if (!nextActive) return without;
                const reordered = without.filter((id) => id !== nextActive);
                return [nextActive, ...reordered].slice(0, NOTE_EDITOR_POOL_SIZE);
            });
            persist(next, nextActive);
        },
        [persist]
    );

    const updateTabTitle = useCallback((noteId: number, kind: NoteTabKind, title: string) => {
        const current = tabsRef.current;
        const id = tabIdFor(kind, noteId);
        const idx = current.findIndex((t) => t.id === id);
        if (idx === -1) return;
        if (current[idx].title === title) return;
        const next = current.map((t, i) => (i === idx ? { ...t, title } : t));
        setTabs(next);
        // Title-only change doesn't change the active tab; we only
        // need to persist when the persisted shape (refs) is touched.
        // Since title isn't persisted, we skip the persist call here.
    }, []);

    // Correct a personal-backed tab's bucket after the fact. Needed
    // because the bucket is often UNKNOWABLE at open time: a tab opened
    // from an activity click or a push URL says "my" (the backend only
    // has three note types), and the team/shared meta lists that could
    // disambiguate may not have loaded yet. useNoteManagement heals the
    // bucket through this once they arrive. Unlike a title change the
    // bucket IS persisted, so the strip is re-saved.
    const updateTabBucket = useCallback(
        (noteId: number, bucket: NoteBucket) => {
            const current = tabsRef.current;
            const idx = current.findIndex((t) => t.kind === "my" && t.noteId === noteId);
            if (idx === -1) return;
            const tab = current[idx];
            if (tab.kind !== "my" || (tab.bucket ?? "my") === bucket) return;
            const next = current.map((t, i) => (i === idx ? { ...t, bucket } : t));
            setTabs(next);
            persist(next, activeIdRef.current);
        },
        [persist]
    );

    const rehydrate = useCallback(async () => {
        if (!myself.teamId) return;
        hasHydratedRef.current = false;

        const persisted = loadPersistedTabs(myself.teamId);
        if (!persisted || persisted.tabs.length === 0) {
            setTabs([]);
            setActiveTabId(null);
            setLiveTabIds([]);
            hasHydratedRef.current = true;
            lastTeamIdRef.current = myself.teamId;
            return;
        }

        const resolved = await Promise.all(
            persisted.tabs.map((ref) => resolveRefToTab(ref, myself.teamId))
        );
        const validTabs = resolved.filter((t): t is NoteTab => t !== null);

        // If the stored teamId changed mid-flight, ignore — a newer
        // rehydrate has already started for the latest team.
        if (myself.teamId !== lastTeamIdRef.current && lastTeamIdRef.current !== null) {
            return;
        }

        const safeIdx =
            validTabs.length === 0
                ? 0
                : Math.max(0, Math.min(persisted.selectedTabIndex, validTabs.length - 1));
        const nextActive = validTabs.length === 0 ? null : validTabs[safeIdx].id;
        setTabs(validTabs);
        setActiveTabId(nextActive);
        // Seed the live pool with the selected tab only — other persisted
        // tabs enter the pool lazily as the user clicks them. Avoids
        // mounting 100 BlockNote editors on app start.
        setLiveTabIds(nextActive ? [nextActive] : []);
        hasHydratedRef.current = true;
        lastTeamIdRef.current = myself.teamId;
    }, [myself.teamId, resolveRefToTab]);

    // Auto-rehydrate on team change. Clears immediately on team switch
    // (so the previous team's tabs don't leak across) and then resolves
    // the new team's persisted strip.
    useEffect(() => {
        if (!myself.teamId) {
            setTabs([]);
            setActiveTabId(null);
            setLiveTabIds([]);
            hasHydratedRef.current = false;
            lastTeamIdRef.current = null;
            return;
        }
        if (lastTeamIdRef.current === myself.teamId) return;
        // Drop current state immediately on team switch — otherwise the
        // previous team's mounted editors would briefly linger while
        // rehydrate resolves the new team's persisted strip.
        if (lastTeamIdRef.current !== null && lastTeamIdRef.current !== myself.teamId) {
            setTabs([]);
            setActiveTabId(null);
            setLiveTabIds([]);
        }
        let cancelled = false;
        (async () => {
            await rehydrate();
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.teamId]);

    return {
        tabs,
        activeTab,
        activeTabId,
        openTick,
        liveTabIds,
        openTab,
        switchTab,
        closeTab,
        updateTabTitle,
        updateTabBucket,
        rehydrate,
    };
};

// Helpers for callers that have a full note object and want a tab.
export const noteToTab = (
    note: {
        noteType: number;
        noteId: number;
        title: string;
        projectId?: number;
        taskId?: number;
        chatType?: number;
        chatId?: number;
        isThread?: boolean;
        threadId?: number;
    },
    teamId: string,
    // Defaults to "my" so every existing call site keeps its behavior;
    // only the Team Notes / Shared Notes sections pass anything else.
    bucket: NoteBucket = "my"
): NoteTab => {
    if (note.noteType === 1) {
        return {
            kind: "my",
            noteType: 1,
            noteId: note.noteId,
            bucket,
            id: tabIdFor("my", note.noteId),
            title: note.title,
            teamId,
        };
    }
    if (note.noteType === 2) {
        return {
            kind: "task",
            noteType: 2,
            noteId: note.noteId,
            projectId: note.projectId ?? 0,
            taskId: note.taskId ?? 0,
            id: tabIdFor("task", note.noteId),
            title: note.title,
            teamId,
        };
    }
    return {
        kind: "chat",
        noteType: 3,
        noteId: note.noteId,
        chatType: note.chatType ?? 0,
        chatId: note.chatId ?? 0,
        isThread: note.isThread ?? false,
        threadId: note.threadId ?? 0,
        id: tabIdFor("chat", note.noteId),
        title: note.title,
        teamId,
    };
};

// Re-exports used by call sites that previously imported the legacy
// wrapper hook (`useNoteTabs`) to clear unused-import warnings during
// migration. Kept tiny so the bundle isn't affected.
export { clearPersistedTabs };
