import { useState } from "react";

const storageKey = (userId: string) => `genos.taskStats.teamLoad.${userId}`;

const read = (userId: string): boolean => {
    try {
        return window.localStorage.getItem(storageKey(userId)) === "1";
    } catch {
        return false;
    }
};

/**
 * Whether the People tab's "Team load" is open (MIP-1963). Collapsed by default, so opening the
 * tab sends no team-wide read; the choice is remembered per user in this browser. A per-user
 * convenience only, so a blocked or empty store just means collapsed.
 */
export const useTeamLoadOpen = (userId: string) => {
    const [open, setOpen] = useState<boolean>(() => read(userId));
    const set = (next: boolean) => {
        setOpen(next);
        try {
            window.localStorage.setItem(storageKey(userId), next ? "1" : "0");
        } catch {
            // Private window or blocked storage: it stays collapsed next time.
        }
    };
    return [open, set] as const;
};
