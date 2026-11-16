// "Leave this one unread" (MIP-1627).
//
// A card that has been on screen for a moment is marked read by itself (`reportReadScheduler`).
// A member who then taps "Mark as unread" is saying "keep this for later", and the very next
// dwell on the same card would undo it. So a card marked unread by hand is HELD: it takes no
// part in the read-on-view rule until the member reads it by hand, or marks everything read.
//
// Kept in localStorage so it survives a reload (the card is often still on screen after one);
// that is per device, which is the honest limit: another device has no such memory, and the
// server has no column for it. Capped, oldest first, so it cannot grow without bound. Every
// access is wrapped: storage can be blocked, full or absent (private windows, tests).

const STORAGE_KEY = "genos:inbox:held-unread";
const MAX_HELD = 500;

/** Member, team and item: the same shape `useMarkReadOnView` keys its dwell with. */
export const readKey = (userId: string, teamId: string, itemId: number): string =>
    `${userId}|${teamId}|${itemId}`;

let memory: string[] | null = null;

const load = (): string[] => {
    if (memory) return memory;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        memory = Array.isArray(parsed)
            ? parsed.filter((k): k is string => typeof k === "string")
            : [];
    } catch {
        memory = [];
    }
    return memory;
};

const save = (keys: string[]): void => {
    memory = keys;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
        /* the in-memory copy still holds for this page's life */
    }
};

export const isHeldUnread = (key: string): boolean => load().includes(key);

/** Keep this card unread: it is not marked read by being looked at. */
export const holdUnread = (key: string): void => {
    const keys = load().filter((k) => k !== key);
    keys.push(key);
    save(keys.length > MAX_HELD ? keys.slice(keys.length - MAX_HELD) : keys);
};

/** The member read it by hand (or marked everything read): the rule applies to it again. */
export const releaseHold = (key: string): void => {
    const keys = load();
    if (keys.includes(key)) save(keys.filter((k) => k !== key));
};

/** Forget everything held (a test, or the member signing out). */
export const resetReadHold = (): void => {
    memory = null;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* nothing stored, or no storage */
    }
};
