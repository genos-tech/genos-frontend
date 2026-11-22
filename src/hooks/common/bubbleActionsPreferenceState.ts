import { createContext, useContext } from "react";

/**
 * Which message actions sit directly on the bubble's hover toolbar instead of
 * behind the "…" menu (MIP-803). One list for chat messages, thread replies and task comments
 * (MIP-1434); an action a surface does not offer is simply not shown there (a comment has no
 * Reply, and its Edit is its own button).
 *
 * Stored as a list of action ids. The ORDER stored does not matter: the
 * toolbar always follows `PINNABLE_BUBBLE_ACTIONS`, which is the order of the
 * menu, so what a user pins reads the same as what they would have clicked.
 * Anything unknown, duplicated or over the limit is dropped on read, so a
 * list written by a newer build (or a corrupt one) can't render a button
 * that does nothing.
 *
 * Persistence mirrors `useBubbleStylePreference`: localStorage for the
 * synchronous first paint, the cross-device `ui_settings` store for sync,
 * and a write only on an EXPLICIT pick — an effect keyed on the value would
 * persist the default on mount and pin everyone to it.
 */

/** In the order the menu lists them (the shared order in `moreMenuOrder.ts`). */
export const PINNABLE_BUBBLE_ACTIONS = [
    "reply",
    "copyLink",
    "flag",
    "remindMe",
    "addToTodo",
    "unwrapAll",
    "edit",
    "delete",
] as const;

export type PinnableBubbleAction = (typeof PINNABLE_BUBBLE_ACTIONS)[number];

/** The toolbar stays reasonable, and the "…" menu keeps something in it. */
export const MAX_PINNED_BUBBLE_ACTIONS = 4;

// Keep in sync with DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS in
// context/AuthContext.tsx (a PRESERVE list — an unlisted key is wiped when a
// different user signs in on the same device).
const STORAGE_KEY = "genos-bubble-pinned-actions-v1";
// Key inside the cross-device `ui_settings` store.
export const UI_SETTINGS_KEY = "bubblePinnedActions";

/** Coerce anything read from storage into a valid, ordered, capped list. */
export const normalizePinnedBubbleActions = (value: unknown): PinnableBubbleAction[] => {
    if (!Array.isArray(value)) return [];
    const asked = new Set<unknown>(value);
    return PINNABLE_BUBBLE_ACTIONS.filter((id) => asked.has(id)).slice(
        0,
        MAX_PINNED_BUBBLE_ACTIONS
    );
};

/** `null` = this device has no explicit pick (as opposed to an empty one). */
export const readStored = (): PinnableBubbleAction[] | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? normalizePinnedBubbleActions(parsed) : null;
    } catch {
        return null;
    }
};

export const sameList = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

export const writeStored = (ids: PinnableBubbleAction[]) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // Private mode / quota — the choice still applies for this session.
    }
};

interface BubbleActionsPreferenceContextValue {
    /** The pinned actions, in toolbar order. Empty = today's toolbar. */
    pinned: PinnableBubbleAction[];
    /** Pin or unpin one action. Pinning past the limit is ignored. */
    setPinned: (id: PinnableBubbleAction, pinned: boolean) => void;
    /** Unpin everything. */
    reset: () => void;
}

export const BubbleActionsPreferenceContext =
    createContext<BubbleActionsPreferenceContextValue | null>(null);

export const useBubbleActionsPreference = (): BubbleActionsPreferenceContextValue => {
    const ctx = useContext(BubbleActionsPreferenceContext);
    if (!ctx) return { pinned: [], setPinned: () => {}, reset: () => {} };
    return ctx;
};
