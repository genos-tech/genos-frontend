// Per-team localStorage cache of which note tabs the user has open.
//
// We persist only the *identity* of each tab — `{ noteType, noteId }` —
// rather than the full note record. On rehydrate the hook re-fetches each
// note through the existing IDB-first / backend-fallback path, which keeps
// titles fresh (renames done in another session show up after refresh) and
// silently drops anything that was deleted server-side.

const STORAGE_KEY_PREFIX = "noteTabs:";

export type NoteTypeId = 1 | 2 | 3;

export interface TabRef {
    noteType: NoteTypeId;
    noteId: number;
}

// `tmpTabs` is legacy: the old per-service swap (chat/task/notes)
// shoved tabs in here when the user navigated away. The new
// architecture (see `useNoteTabs`) never touches the strip on service
// change, so writes drop this field entirely. We still tolerate it on
// read so that existing localStorage records load cleanly without
// resetting the user's tabs.
export interface PersistedNoteTabs {
    tabs: TabRef[];
    tmpTabs?: TabRef[];
    selectedTabIndex: number;
}

const storageKey = (teamId: string): string => `${STORAGE_KEY_PREFIX}${teamId}`;

const isValidRef = (value: unknown): value is TabRef => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { noteType?: unknown; noteId?: unknown };
    return (
        (candidate.noteType === 1 || candidate.noteType === 2 || candidate.noteType === 3) &&
        typeof candidate.noteId === "number" &&
        Number.isFinite(candidate.noteId)
    );
};

// A loose shape for any note-like object the in-memory `tabItems` state
// might carry. The hook stores full notes (`MyNoteProps | TaskNoteProps |
// ChatNoteProps`) but we only need the identity fields here.
type NoteLike = { noteType?: unknown; noteId?: unknown } | null | undefined;

// Project a (possibly full) note-like object down to the persistence ref.
// Returns null when the input lacks usable identity fields so callers can
// drop it cleanly.
export const toRef = (item: NoteLike): TabRef | null => {
    if (!item) return null;
    const { noteType, noteId } = item;
    const ref = { noteType, noteId };
    return isValidRef(ref) ? ref : null;
};

// Map an array of notes/refs to refs, dropping anything invalid and
// deduplicating by `${noteType}-${noteId}` to defend against accidental
// duplicates landing in `tabItems` (the React state isn't constraint-checked).
export const toRefs = (items: readonly NoteLike[]): TabRef[] => {
    const seen = new Set<string>();
    const out: TabRef[] = [];
    for (const item of items) {
        const ref = toRef(item);
        if (!ref) continue;
        const key = `${ref.noteType}-${ref.noteId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ref);
    }
    return out;
};

export const loadPersistedTabs = (teamId: string): PersistedNoteTabs | null => {
    if (!teamId) return null;
    let raw: string | null;
    try {
        raw = localStorage.getItem(storageKey(teamId));
    } catch {
        // Private mode / storage disabled.
        return null;
    }
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        const tabs = Array.isArray(parsed.tabs) ? parsed.tabs.filter(isValidRef) : [];
        const rawIdx = parsed.selectedTabIndex;
        const selectedTabIndex =
            typeof rawIdx === "number" && Number.isFinite(rawIdx) && rawIdx >= 0 ? rawIdx : 0;
        // Drop `tmpTabs` if present in the persisted record — it was
        // only ever a transient holding pen and the new architecture
        // doesn't need it.
        return { selectedTabIndex, tabs };
    } catch {
        // Corrupted JSON — discard so the next save overwrites cleanly.
        return null;
    }
};

export const savePersistedTabs = (teamId: string, payload: PersistedNoteTabs): void => {
    if (!teamId) return;
    try {
        localStorage.setItem(storageKey(teamId), JSON.stringify(payload));
    } catch {
        // Quota exceeded / private mode — silently ignore. The next change
        // will retry, and a missing record just means we boot empty.
    }
};

export const clearPersistedTabs = (teamId: string): void => {
    if (!teamId) return;
    try {
        localStorage.removeItem(storageKey(teamId));
    } catch {
        // Same swallow as above.
    }
};
