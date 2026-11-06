import { SetStateAction, useCallback, useRef, useState } from "react";

// Which folders of the task sidebar are open (MIP-1055). Browser storage only,
// by design: it is a preference of this device, not data, so nothing goes to
// the server. One map per person (the sidebar's folders differ by account),
// `{ "<folder id>": open }`, under a versioned key.
//
// It survives sign-out on purpose: it holds only folder ids (no names, no
// content), and the point is that the sidebar looks the way it was left.
const STORAGE_PREFIX = "genos.taskSidebar.open.v1.";
// Folders come and go (a deleted project, a renamed sprint). Keep the newest
// entries only, so the map cannot grow for ever.
const MAX_ENTRIES = 400;

const storageKey = (): string => `${STORAGE_PREFIX}${localStorage.getItem("userId") || "anon"}`;

const readMap = (): Record<string, boolean> => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const out: Record<string, boolean> = {};
        for (const [id, value] of Object.entries(parsed)) {
            if (typeof value === "boolean") out[id] = value;
        }
        return out;
    } catch {
        // Storage unavailable (a private window, blocked site data) or corrupt:
        // the sidebar simply starts from its defaults.
        return {};
    }
};

export const readSidebarOpen = (id: string, defaultOpen: boolean): boolean => {
    const stored = readMap()[id];
    return typeof stored === "boolean" ? stored : defaultOpen;
};

export const writeSidebarOpen = (id: string, open: boolean): void => {
    try {
        const map = readMap();
        // Re-inserted last, so the oldest entries are the ones pruned.
        delete map[id];
        map[id] = open;
        const keys = Object.keys(map);
        for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) {
            delete map[stale];
        }
        localStorage.setItem(storageKey(), JSON.stringify(map));
    } catch {
        // Not worth failing a click over; the folder still opens, it is just
        // not remembered.
    }
};

/**
 * `useState(open)` for a sidebar folder that remembers itself. Starts from what
 * the user left (or `defaultOpen` the first time) and saves every change they
 * make. With no `id` it is plain state, so a folder without a stable identity
 * stays exactly as it was.
 *
 * Opening a folder FOR the user (Recents revealing the group of the task they
 * have open) must not go through the setter: that is a passing reveal, not a
 * choice, and saving it would reopen the folder on every later visit.
 */
export const useSidebarOpen = (
    id: string | undefined,
    defaultOpen: boolean
): [boolean, (next: SetStateAction<boolean>) => void] => {
    const [open, setOpenState] = useState(() =>
        id ? readSidebarOpen(id, defaultOpen) : defaultOpen
    );
    const openRef = useRef(open);
    openRef.current = open;

    // A folder component reused for another id (no `key`) re-reads, instead of
    // showing the previous folder's state.
    const [loadedFor, setLoadedFor] = useState(id);
    if (loadedFor !== id) {
        const next = id ? readSidebarOpen(id, defaultOpen) : defaultOpen;
        setLoadedFor(id);
        setOpenState(next);
        openRef.current = next;
    }

    const setOpen = useCallback(
        (next: SetStateAction<boolean>) => {
            const value = typeof next === "function" ? next(openRef.current) : next;
            openRef.current = value;
            setOpenState(value);
            if (id) writeSidebarOpen(id, value);
        },
        [id]
    );
    return [open, setOpen];
};
